import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { slugify, countWords } from "@/lib/newArticle";
import {
  SiteRow,
  BrandProfileRow,
  BrandRow,
  RubricCriterion,
  RubricRow,
  PromptRow,
  Issue,
  STALE_AFTER_DAYS,
  isNonEmptyString,
  isStringArray,
  formatBulletList,
  formatBrandFacts,
  formatBrandProfileText,
  formatTerminology,
  formatRubricText,
  fillTemplate,
  daysSince,
  callDeepSeek,
  WRITER_MAX_TOKENS,
  GRADER_MAX_TOKENS,
  OUTLINE_MAX_TOKENS,
  ChatMessage,
  DeepSeekResult,
  DeepSeekSuccess,
  parseWriterOutput,
  WriterOutput,
  extractJsonObject,
  resolveGraderOutput,
  logParseFailure,
  captureGraderParseFailure,
  GraderParseFailure,
  recomputeWeightedTotal,
  findLowScoreCriterion,
  runLintChecks,
  classifyContentShape,
  insertArticleWithRetry,
  updateArticleTitleWithRetry,
  insertArticleBrands,
  assignKeywordToArticle,
  insertDraft,
  insertGrade,
  notifyN8n,
} from "@/lib/pipelineShared";
import { runResearchStage } from "@/lib/research";
import {
  getInternalLinkCandidates,
  formatInternalLinkCandidates,
} from "@/lib/internalLinking";
import { getSimilarityCandidates } from "@/lib/crossArticleSimilarity";
import { getDomainFacts, formatDomainFacts } from "@/lib/domainFacts";
import {
  buildOutlineSkeleton,
  formatOutlineSkeletonForPrompt,
  formatOutlineForPrompt,
  isPopulatedOutline,
  PopulatedOutline,
} from "@/lib/outline";

const MAX_ATTEMPTS = 3;

// ------------------------------------------------------------
// Input shape
// ------------------------------------------------------------
interface LoopRequestBody {
  site_id: string;
  title: string;
  target_keyword: string;
  keywords: string[];
  brand_names: string[];
  search_intent: string;
}

function validateBody(body: unknown): {
  errors: string[];
  value: LoopRequestBody | null;
} {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { errors: ["Request body must be a JSON object"], value: null };
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.site_id)) errors.push("site_id is required");
  if (!isNonEmptyString(candidate.title)) errors.push("title is required");
  if (!isNonEmptyString(candidate.target_keyword))
    errors.push("target_keyword is required");
  if (!isNonEmptyString(candidate.search_intent))
    errors.push("search_intent is required");
  if (!isStringArray(candidate.keywords))
    errors.push("keywords must be an array of strings");
  if (!isStringArray(candidate.brand_names))
    errors.push("brand_names must be an array of strings (can be empty)");

  if (errors.length > 0) {
    return { errors, value: null };
  }

  return {
    errors: [],
    value: {
      site_id: candidate.site_id as string,
      title: candidate.title as string,
      target_keyword: candidate.target_keyword as string,
      search_intent: candidate.search_intent as string,
      keywords: candidate.keywords as string[],
      brand_names: candidate.brand_names as string[],
    },
  };
}

// ------------------------------------------------------------
// Prompt loading — site-specific first, generic fallback. Factored
// locally since this route needs it for three different roles.
// ------------------------------------------------------------
async function loadActivePrompt(
  supabaseAdmin: SupabaseClient,
  role: string,
  contentProfile: string,
): Promise<{ prompt: PromptRow | null; error: string | null }> {
  const { data: specific, error: specificError } = await supabaseAdmin
    .from("prompts")
    .select("id,body,model")
    .eq("role", role)
    .is("variant", null)
    .eq("content_profile", contentProfile)
    .eq("active", true)
    .maybeSingle();

  if (specificError) {
    return { prompt: null, error: `Could not load ${role} prompt` };
  }
  if (specific) {
    return { prompt: specific as PromptRow, error: null };
  }

  const { data: generic, error: genericError } = await supabaseAdmin
    .from("prompts")
    .select("id,body,model")
    .eq("role", role)
    .is("variant", null)
    .is("content_profile", null)
    .eq("active", true)
    .maybeSingle();

  if (genericError) {
    return { prompt: null, error: `Could not load ${role} prompt` };
  }
  if (!generic) {
    return {
      prompt: null,
      error: `no active ${role} prompt for content_profile '${contentProfile}'`,
    };
  }
  return { prompt: generic as PromptRow, error: null };
}

// ------------------------------------------------------------
// Format the grader's issues into readable text for the reviser prompt
// ------------------------------------------------------------
function formatIssuesForReviser(issues: Issue[]): string {
  if (issues.length === 0) return "(no specific issues recorded)";
  return issues
    .map(
      (issue, index) =>
        `${index + 1}. [${issue.severity}] ${issue.criterion}\n` +
        `   Quote: "${issue.quote}"\n` +
        `   Problem: ${issue.problem}\n` +
        `   Suggested fix: ${issue.suggested_fix}`,
    )
    .join("\n\n");
}

// ------------------------------------------------------------
// One attempt's outcome, used to track the best draft across attempts
// ------------------------------------------------------------
interface AttemptResult {
  draftId: string;
  weightedTotal: number;
  passed: boolean;
  hardFailReason: string | null;
  issues: Issue[];
  bodyMarkdown: string;
}

// Ranking rule: a passing draft always beats a hard-failed one, regardless
// of score. Among two passing drafts, higher score wins. Among two failed
// drafts (only reached if nothing has passed yet), higher score is kept
// as the "least bad" fallback for the human reviewer.
function isBetter(
  candidate: AttemptResult,
  currentBest: AttemptResult | null,
): boolean {
  if (!currentBest) return true;
  if (candidate.passed && !currentBest.passed) return true;
  if (!candidate.passed && currentBest.passed) return false;
  return candidate.weightedTotal > currentBest.weightedTotal;
}

// ------------------------------------------------------------
// Route
// ------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startedAt = new Date();

  const expectedSecret = process.env.PIPELINE_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: PIPELINE_SECRET is not set" },
      { status: 500 },
    );
  }

  const providedSecret = request.headers.get("x-pipeline-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekApiKey) {
    return NextResponse.json(
      { error: "Server misconfigured: DEEPSEEK_API_KEY is not set" },
      { status: 500 },
    );
  }

  // SerpAPI/Firecrawl credentials live in n8n only (n8n credentials are
  // write-only — the raw keys can't be exported back out), so the actual
  // search + scrape calls happen inside an n8n workflow, not here.
  const researchWebhookUrl = process.env.RESEARCH_WEBHOOK_URL;
  if (!researchWebhookUrl) {
    return NextResponse.json(
      { error: "Server misconfigured: RESEARCH_WEBHOOK_URL is not set" },
      { status: 500 },
    );
  }
  const researchWebhookSecret = process.env.N8N_WEBHOOK_SECRET;

  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      {
        error: "Server misconfigured: Supabase admin client is not configured",
      },
      { status: 500 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { errors, value: input } = validateBody(rawBody);
  if (!input) {
    return NextResponse.json(
      { error: "Invalid input", details: errors },
      { status: 400 },
    );
  }

  // ---- site, brand profile, brands ----
  const { data: site, error: siteError } = await supabaseAdmin
    .from("sites")
    .select("id,name,domain,vertical,audience,monetisation,content_profile")
    .eq("id", input.site_id)
    .maybeSingle();

  if (siteError) {
    return NextResponse.json({ error: "Could not load site" }, { status: 500 });
  }
  if (!site) {
    return NextResponse.json({ error: "Unknown site_id" }, { status: 404 });
  }
  const siteRow = site as SiteRow;

  const { data: brandProfile, error: profileError } = await supabaseAdmin
    .from("brand_profiles")
    .select(
      "tone,reading_level,person,sentence_rhythm,use_contractions,use_em_dashes,structure_rules,heading_style,heading_case,opening_style,cta_style,banned_words,mandatory_elements,must_avoid,typical_word_count,terminology",
    )
    .eq("site_id", siteRow.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Could not load brand profile" },
      { status: 500 },
    );
  }
  if (!brandProfile) {
    return NextResponse.json(
      { error: "no brand profile seeded for this site" },
      { status: 400 },
    );
  }
  const profile = brandProfile as BrandProfileRow;

  const requestedNames = Array.from(new Set(input.brand_names));
  let brands: BrandRow[] = [];

  if (requestedNames.length > 0) {
    const { data: brandRows, error: brandsError } = await supabaseAdmin
      .from("brands")
      .select(
        "id,name,what_they_are,strengths,weaknesses,eligibility,product_range,rate_note,last_verified_at,active",
      )
      .in("name", requestedNames);

    if (brandsError) {
      return NextResponse.json(
        { error: "Could not load brands" },
        { status: 500 },
      );
    }

    const found = (brandRows ?? []) as BrandRow[];
    const foundByName = new Map(found.map((b) => [b.name, b]));

    const missingNames = requestedNames.filter(
      (name) => !foundByName.has(name),
    );
    const inactiveNames = found.filter((b) => !b.active).map((b) => b.name);

    if (missingNames.length > 0 || inactiveNames.length > 0) {
      return NextResponse.json(
        {
          error:
            "refusing job — one or more brands are not a verified, active record",
          missing_brands: missingNames,
          inactive_brands: inactiveNames,
        },
        { status: 400 },
      );
    }

    brands = requestedNames.map((name) => foundByName.get(name) as BrandRow);
  }

  const warnings: string[] = [];
  for (const brand of brands) {
    const age = daysSince(brand.last_verified_at);
    if (age === null) {
      warnings.push(`${brand.name}: last_verified_at is not set`);
    } else if (age > STALE_AFTER_DAYS) {
      warnings.push(
        `${brand.name}: last verified ${brand.last_verified_at} (${Math.floor(age)} days ago, over ${STALE_AFTER_DAYS})`,
      );
    }
  }

  // ---- what kind of article this actually is, so structure isn't forced
  // into a comparison/recommendation shape when nothing is being compared ----
  const contentShape = classifyContentShape(brands.length, input.search_intent);

  // ---- prompts: writer, reviser, grader — all generic-fallback the same way ----
  const { prompt: writerPrompt, error: writerPromptError } =
    await loadActivePrompt(supabaseAdmin, "writer", siteRow.content_profile);
  if (writerPromptError || !writerPrompt) {
    return NextResponse.json(
      { error: writerPromptError ?? "Could not load writer prompt" },
      { status: 400 },
    );
  }

  const { prompt: reviserPrompt, error: reviserPromptError } =
    await loadActivePrompt(supabaseAdmin, "reviser", siteRow.content_profile);
  if (reviserPromptError || !reviserPrompt) {
    return NextResponse.json(
      { error: reviserPromptError ?? "Could not load reviser prompt" },
      { status: 400 },
    );
  }

  const { prompt: graderPrompt, error: graderPromptError } =
    await loadActivePrompt(supabaseAdmin, "grader", siteRow.content_profile);
  if (graderPromptError || !graderPrompt) {
    return NextResponse.json(
      { error: graderPromptError ?? "Could not load grader prompt" },
      { status: 400 },
    );
  }

  const { prompt: outlinePrompt, error: outlinePromptError } =
    await loadActivePrompt(supabaseAdmin, "outline", siteRow.content_profile);
  if (outlinePromptError || !outlinePrompt) {
    return NextResponse.json(
      { error: outlinePromptError ?? "Could not load outline prompt" },
      { status: 400 },
    );
  }

  // ---- active rubric for this content profile ----
  const { data: rubric, error: rubricError } = await supabaseAdmin
    .from("rubrics")
    .select("id,criteria,hard_fail_rules,pass_threshold")
    .eq("content_profile", siteRow.content_profile)
    .eq("active", true)
    .maybeSingle();

  if (rubricError) {
    return NextResponse.json(
      { error: "Could not load rubric" },
      { status: 500 },
    );
  }
  if (!rubric) {
    return NextResponse.json(
      {
        error: `no active rubric for content_profile '${siteRow.content_profile}'`,
      },
      { status: 400 },
    );
  }
  const rubricRow = rubric as RubricRow;
  const requiredCriteria = rubricRow.criteria.map(
    (c: RubricCriterion) => c.name,
  );

  // ---- create the article once; every attempt adds a draft version ----
  let article: { id: string };
  try {
    article = await insertArticleWithRetry(
      supabaseAdmin,
      {
        site_id: siteRow.id,
        title: input.title,
        target_keyword: input.target_keyword,
        search_intent: input.search_intent,
        slug: slugify(input.title),
        status: "drafted",
      },
      slugify,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create article";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const brandJoinError = await insertArticleBrands(
    supabaseAdmin,
    article.id,
    brands,
  );
  if (brandJoinError) {
    return NextResponse.json(
      { error: `Article created but could not link brands: ${brandJoinError}` },
      { status: 500 },
    );
  }

  // ---- best-effort: mark the matching keywords row as used, if one
  // exists and isn't already claimed. Never blocks or fails article
  // creation -- see assignKeywordToArticle in pipelineShared.ts. ----
  await assignKeywordToArticle(
    supabaseAdmin,
    siteRow.id,
    input.target_keyword,
    article.id,
  );

  // ---- research stage: runs once, before attempt 1. The underlying
  // facts don't change between retries, so there's no reason to pay for
  // fresh searches on every attempt. A failure here is a real pipeline
  // error, not something to swallow — proceeding with no research
  // reproduces the exact zero-figures bug this stage exists to fix. ----
  let research;
  try {
    research = await runResearchStage(
      researchWebhookUrl,
      researchWebhookSecret,
      article.id,
      input.target_keyword,
      contentShape,
      brands,
      siteRow.vertical ?? "",
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "n8n research webhook call failed";
    return NextResponse.json(
      { error: `Article created but research stage failed: ${message}`, article_id: article.id },
      { status: 502 },
    );
  }

  const { error: researchInsertError } = await supabaseAdmin
    .from("research_facts")
    .insert({
      article_id: article.id,
      queries: research.queries,
      sources: research.sources,
      fact_sheet: research.factSheet,
    });
  if (researchInsertError) {
    return NextResponse.json(
      {
        error: `Article created but could not save research facts: ${researchInsertError.message}`,
      },
      { status: 500 },
    );
  }

  // ---- internal link candidates: runs once, before attempt 1, same
  // reasoning as the research stage — the site's real published catalog
  // doesn't change meaningfully across 3 attempts a few minutes apart. ----
  let internalLinkCandidates;
  try {
    internalLinkCandidates = await getInternalLinkCandidates(
      supabaseAdmin,
      siteRow.id,
      article.id,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load internal link candidates";
    return NextResponse.json(
      { error: `Article created but internal link lookup failed: ${message}`, article_id: article.id },
      { status: 500 },
    );
  }
  const internalLinkCandidatesText = formatInternalLinkCandidates(internalLinkCandidates);
  const validInternalLinkSlugs = internalLinkCandidates.map((c) => c.slug);

  // ---- cross-article similarity candidates: runs once, before attempt 1,
  // same reasoning as internal link candidates -- the site's real
  // published catalog doesn't change meaningfully across 3 attempts a
  // few minutes apart. Same-site, published-only scope (Fix 6 item #7). ----
  let similarityCandidates;
  try {
    similarityCandidates = await getSimilarityCandidates(
      supabaseAdmin,
      siteRow.id,
      article.id,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load similarity candidates";
    return NextResponse.json(
      { error: `Article created but similarity candidate lookup failed: ${message}`, article_id: article.id },
      { status: 500 },
    );
  }

  // ---- curated domain facts: runs once, before attempt 1, keyed on the
  // site's real vertical (not content_profile -- see lib/domainFacts.ts). ----
  let domainFacts;
  try {
    domainFacts = await getDomainFacts(supabaseAdmin, siteRow.vertical ?? "");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load domain facts";
    return NextResponse.json(
      { error: `Article created but domain facts lookup failed: ${message}`, article_id: article.id },
      { status: 500 },
    );
  }
  const domainFactsText = formatDomainFacts(domainFacts);

  // ---- outline stage: runs once, before attempt 1, same lifecycle as
  // research/domain-facts/content-shape above. The section skeleton
  // (which named sections, in what order) is deterministic from
  // contentShape -- buildOutlineSkeleton() below, no AI call. The AI
  // call here does one narrower job: populate that skeleton with real
  // headings/key_points grounded in this assignment's already-fetched
  // facts, and commit a real takeaway_count/faq_topics. Reused
  // unchanged by every reviser attempt, so a content-only hard-fail on
  // attempt 2 doesn't also silently reshuffle the article's structure. ----
  const outlineSkeleton = buildOutlineSkeleton(contentShape, brands);
  const outlineSkeletonText = formatOutlineSkeletonForPrompt(outlineSkeleton);

  const outlineStartedAt = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const resolvedOutlinePrompt = fillTemplate(outlinePrompt.body, {
    vertical: siteRow.vertical ?? "",
    content_shape: contentShape,
    title: input.title,
    target_keyword: input.target_keyword,
    search_intent: input.search_intent,
    keywords: input.keywords.join(", "),
    brand_facts: formatBrandFacts(brands),
    research_facts: research.factSheet,
    domain_facts: domainFactsText,
    outline_skeleton: outlineSkeletonText,
  });

  const outlineMessages: ChatMessage[] = [
    { role: "user", content: resolvedOutlinePrompt },
  ];
  let outlineAttempt: DeepSeekResult;
  try {
    outlineAttempt = await callDeepSeek(
      deepseekApiKey,
      outlinePrompt.model,
      outlineMessages,
      OUTLINE_MAX_TOKENS,
      true,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "DeepSeek call failed";
    return NextResponse.json(
      { error: `Article created but outline stage failed: ${message}`, article_id: article.id },
      { status: 502 },
    );
  }
  if (!outlineAttempt.ok) {
    return NextResponse.json(
      {
        error: `Article created but outline stage failed: DeepSeek API error: ${JSON.stringify(outlineAttempt.detail)}`,
        article_id: article.id,
      },
      { status: 502 },
    );
  }
  totalInputTokens += outlineAttempt.inputTokens;
  totalOutputTokens += outlineAttempt.outputTokens;

  function parseOutline(raw: string): PopulatedOutline | null {
    const jsonText = extractJsonObject(raw);
    if (!jsonText) return null;
    try {
      const parsed: unknown = JSON.parse(jsonText);
      return isPopulatedOutline(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  let populatedOutline = parseOutline(outlineAttempt.content);

  if (!populatedOutline) {
    outlineMessages.push({ role: "assistant", content: outlineAttempt.content });
    outlineMessages.push({
      role: "user",
      content: "Your last response was not valid JSON. Return only the JSON object.",
    });
    let outlineRetry: DeepSeekResult;
    try {
      outlineRetry = await callDeepSeek(
        deepseekApiKey,
        outlinePrompt.model,
        outlineMessages,
        OUTLINE_MAX_TOKENS,
        true,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "DeepSeek call failed";
      return NextResponse.json(
        { error: `Article created but outline stage failed: ${message}`, article_id: article.id },
        { status: 502 },
      );
    }
    if (!outlineRetry.ok) {
      return NextResponse.json(
        {
          error: `Article created but outline stage failed: DeepSeek API error: ${JSON.stringify(outlineRetry.detail)}`,
          article_id: article.id,
        },
        { status: 502 },
      );
    }
    totalInputTokens += outlineRetry.inputTokens;
    totalOutputTokens += outlineRetry.outputTokens;
    populatedOutline = parseOutline(outlineRetry.content);
  }

  if (!populatedOutline) {
    return NextResponse.json(
      {
        error: "Article created but outline stage did not return valid JSON after one retry",
        article_id: article.id,
      },
      { status: 502 },
    );
  }

  const outlineDurationMs = Date.now() - outlineStartedAt;
  console.log(
    `outline population for article ${article.id}: ${outlineDurationMs}ms, ` +
      `${totalInputTokens} input tokens, ${totalOutputTokens} output tokens`,
  );

  const { error: outlineInsertError } = await supabaseAdmin
    .from("outlines")
    .insert({
      article_id: article.id,
      content_shape: contentShape,
      sections: populatedOutline,
    });
  if (outlineInsertError) {
    return NextResponse.json(
      {
        error: `Article created but could not save outline: ${outlineInsertError.message}`,
        article_id: article.id,
      },
      { status: 500 },
    );
  }

  const outlineText = formatOutlineForPrompt(populatedOutline);

  // ---- the loop ----
  let firstScore: number | null = null;
  let best: AttemptResult | null = null;
  let outcome: "passed" | "failed_after_retries" | "error" =
    "failed_after_retries";
  let errorDetail: string | null = null;
  let attemptsUsed = 0;
  // Captured whenever the grader returns unparseable JSON, on either the
  // first try or the one retry -- persisted to loop_runs regardless of
  // whether the retry ultimately recovers, so a near-miss is visible too,
  // not just a full run failure. Stays null on every normal run.
  let graderParseFailureLog: GraderParseFailure[] | null = null;

  let previousDraftBody: string | null = null;
  let previousIssues: Issue[] = [];
  let previousScore = 0;
  let previousHardFailReason: string | null = null;
  // input.title is the working brief the writer starts from; once the
  // writer generates its own real title on attempt 1, this becomes that
  // title and the article row is updated to match. The reviser doesn't
  // regenerate it, so this stays fixed for the rest of the run.
  let establishedTitle = input.title;

  attemptLoop: for (
    let attemptNumber = 1;
    attemptNumber <= MAX_ATTEMPTS;
    attemptNumber++
  ) {
    attemptsUsed = attemptNumber;

    // ---- get a draft: writer on attempt 1, reviser after that ----
    let writerOutput: WriterOutput | null = null;
    let rawWriterText = "";

    if (attemptNumber === 1) {
      const resolvedPrompt = fillTemplate(writerPrompt.body, {
        site_name: siteRow.name,
        domain: siteRow.domain,
        vertical: siteRow.vertical ?? "",
        audience: siteRow.audience ?? "",
        monetisation: siteRow.monetisation ?? "",
        tone: profile.tone,
        reading_level: profile.reading_level ?? "",
        person: profile.person ?? "",
        sentence_rhythm: profile.sentence_rhythm ?? "",
        use_contractions: profile.use_contractions ? "yes" : "no",
        use_em_dashes: profile.use_em_dashes ? "yes" : "no",
        structure_rules: profile.structure_rules ?? "",
        heading_style: profile.heading_style ?? "",
        heading_case: profile.heading_case ?? "",
        opening_style: profile.opening_style ?? "",
        cta_style: profile.cta_style ?? "",
        typical_word_count: profile.typical_word_count?.toString() ?? "",
        banned_words: (profile.banned_words ?? []).join(", "),
        mandatory_elements: formatBulletList(profile.mandatory_elements),
        must_avoid: profile.must_avoid ?? "",
        terminology: formatTerminology(profile.terminology),
        brand_facts: formatBrandFacts(brands),
        title: input.title,
        target_keyword: input.target_keyword,
        search_intent: input.search_intent,
        keywords: input.keywords.join(", "),
        content_shape: contentShape,
        research_facts: research.factSheet,
        internal_link_candidates: internalLinkCandidatesText,
        domain_facts: domainFactsText,
        outline: outlineText,
      });

      const messages: ChatMessage[] = [
        { role: "user", content: resolvedPrompt },
      ];
      let attempt: DeepSeekResult;
      try {
        attempt = await callDeepSeek(
          deepseekApiKey,
          writerPrompt.model,
          messages,
          WRITER_MAX_TOKENS,
          false,
        );
      } catch (err) {
        outcome = "error";
        errorDetail =
          err instanceof Error ? err.message : "DeepSeek call failed";
        break attemptLoop;
      }
      if (!attempt.ok) {
        outcome = "error";
        errorDetail = `DeepSeek API error: ${JSON.stringify(attempt.detail)}`;
        break attemptLoop;
      }

      totalInputTokens += attempt.inputTokens;
      totalOutputTokens += attempt.outputTokens;
      rawWriterText = attempt.content;
      writerOutput = parseWriterOutput(rawWriterText);

      if (!writerOutput) {
        messages.push({ role: "assistant", content: rawWriterText });
        messages.push({
          role: "user",
          content:
            "Your last response was not valid JSON. Return only the JSON object.",
        });
        let retry: DeepSeekResult;
        try {
          retry = await callDeepSeek(
            deepseekApiKey,
            writerPrompt.model,
            messages,
            WRITER_MAX_TOKENS,
            false,
          );
        } catch (err) {
          outcome = "error";
          errorDetail =
            err instanceof Error ? err.message : "DeepSeek call failed";
          break attemptLoop;
        }
        if (!retry.ok) {
          outcome = "error";
          errorDetail = `DeepSeek API error: ${JSON.stringify(retry.detail)}`;
          break attemptLoop;
        }
        totalInputTokens += retry.inputTokens;
        totalOutputTokens += retry.outputTokens;
        rawWriterText = retry.content;
        writerOutput = parseWriterOutput(rawWriterText);
      }
    } else {
      const hardFailNote = previousHardFailReason
        ? `This draft also failed a hard-fail rule: ${previousHardFailReason}`
        : "";

      const resolvedPrompt = fillTemplate(reviserPrompt.body, {
        site_name: siteRow.name,
        domain: siteRow.domain,
        vertical: siteRow.vertical ?? "",
        audience: siteRow.audience ?? "",
        monetisation: siteRow.monetisation ?? "",
        tone: profile.tone,
        reading_level: profile.reading_level ?? "",
        person: profile.person ?? "",
        sentence_rhythm: profile.sentence_rhythm ?? "",
        use_contractions: profile.use_contractions ? "yes" : "no",
        use_em_dashes: profile.use_em_dashes ? "yes" : "no",
        structure_rules: profile.structure_rules ?? "",
        heading_style: profile.heading_style ?? "",
        heading_case: profile.heading_case ?? "",
        opening_style: profile.opening_style ?? "",
        cta_style: profile.cta_style ?? "",
        typical_word_count: profile.typical_word_count?.toString() ?? "",
        banned_words: (profile.banned_words ?? []).join(", "),
        mandatory_elements: formatBulletList(profile.mandatory_elements),
        must_avoid: profile.must_avoid ?? "",
        terminology: formatTerminology(profile.terminology),
        brand_facts: formatBrandFacts(brands),
        title: establishedTitle,
        target_keyword: input.target_keyword,
        search_intent: input.search_intent,
        keywords: input.keywords.join(", "),
        previous_draft: previousDraftBody ?? "",
        previous_score: String(previousScore),
        pass_threshold: String(rubricRow.pass_threshold),
        hard_fail_note: hardFailNote,
        issues: formatIssuesForReviser(previousIssues),
        content_shape: contentShape,
        research_facts: research.factSheet,
        internal_link_candidates: internalLinkCandidatesText,
        domain_facts: domainFactsText,
        outline: outlineText,
      });

      const messages: ChatMessage[] = [
        { role: "user", content: resolvedPrompt },
      ];
      let attempt: DeepSeekResult;
      try {
        attempt = await callDeepSeek(
          deepseekApiKey,
          reviserPrompt.model,
          messages,
          WRITER_MAX_TOKENS,
          false,
        );
      } catch (err) {
        outcome = "error";
        errorDetail =
          err instanceof Error ? err.message : "DeepSeek call failed";
        break attemptLoop;
      }
      if (!attempt.ok) {
        outcome = "error";
        errorDetail = `DeepSeek API error: ${JSON.stringify(attempt.detail)}`;
        break attemptLoop;
      }

      totalInputTokens += attempt.inputTokens;
      totalOutputTokens += attempt.outputTokens;
      rawWriterText = attempt.content;
      writerOutput = parseWriterOutput(rawWriterText);

      if (!writerOutput) {
        messages.push({ role: "assistant", content: rawWriterText });
        messages.push({
          role: "user",
          content:
            "Your last response was not valid JSON. Return only the JSON object.",
        });
        let retry: DeepSeekResult;
        try {
          retry = await callDeepSeek(
            deepseekApiKey,
            reviserPrompt.model,
            messages,
            WRITER_MAX_TOKENS,
            false,
          );
        } catch (err) {
          outcome = "error";
          errorDetail =
            err instanceof Error ? err.message : "DeepSeek call failed";
          break attemptLoop;
        }
        if (!retry.ok) {
          outcome = "error";
          errorDetail = `DeepSeek API error: ${JSON.stringify(retry.detail)}`;
          break attemptLoop;
        }
        totalInputTokens += retry.inputTokens;
        totalOutputTokens += retry.outputTokens;
        rawWriterText = retry.content;
        writerOutput = parseWriterOutput(rawWriterText);
      }
    }

    if (!writerOutput) {
      outcome = "error";
      errorDetail = `${attemptNumber === 1 ? "Writer" : "Reviser"} did not return valid JSON after one retry`;
      break attemptLoop;
    }

    // ---- attempt 1 only: apply the writer's real generated title ----
    if (attemptNumber === 1 && isNonEmptyString(writerOutput.title)) {
      establishedTitle = writerOutput.title;
      const titleUpdateResult = await updateArticleTitleWithRetry(
        supabaseAdmin,
        article.id,
        establishedTitle,
        slugify,
      );
      if ("errorMessage" in titleUpdateResult) {
        outcome = "error";
        errorDetail = `Could not apply the writer's title: ${titleUpdateResult.errorMessage}`;
        break attemptLoop;
      }
    }

    // ---- save this attempt as a new draft version ----
    const wordCount = countWords(writerOutput.body_markdown);
    const finalSlug = isNonEmptyString(writerOutput.slug)
      ? slugify(writerOutput.slug)
      : slugify(establishedTitle);

    const draftResult = await insertDraft(supabaseAdmin, {
      article_id: article.id,
      version: attemptNumber,
      body_markdown: writerOutput.body_markdown,
      meta_description: writerOutput.meta_description,
      slug: finalSlug,
      hero_image_alt: writerOutput.hero_image_alt,
      sources: writerOutput.sources,
      internal_links: writerOutput.internal_links,
      word_count: wordCount,
      prompt_id: attemptNumber === 1 ? writerPrompt.id : reviserPrompt.id,
      model: attemptNumber === 1 ? writerPrompt.model : reviserPrompt.model,
      input_tokens: 0,
      output_tokens: 0,
    });

    if ("errorMessage" in draftResult) {
      outcome = "error";
      errorDetail = `Could not save draft: ${draftResult.errorMessage}`;
      break attemptLoop;
    }
    const draftId = draftResult.id;

    // ---- grade this draft ----
    const resolvedGraderPrompt = fillTemplate(graderPrompt.body, {
      site_name: siteRow.name,
      brand_profile: formatBrandProfileText(profile),
      banned_words: (profile.banned_words ?? []).join(", "),
      brand_facts: formatBrandFacts(brands),
      rubric: formatRubricText(rubricRow.criteria),
      hard_fail_rules: formatBulletList(rubricRow.hard_fail_rules),
      pass_threshold: String(rubricRow.pass_threshold),
      title: establishedTitle,
      target_keyword: input.target_keyword,
      typical_word_count: profile.typical_word_count?.toString() ?? "",
      draft: writerOutput.body_markdown,
      content_shape: contentShape,
      research_facts: research.factSheet,
      internal_link_candidates: internalLinkCandidatesText,
      domain_facts: domainFactsText,
    });

    const graderMessages: ChatMessage[] = [
      { role: "user", content: resolvedGraderPrompt },
    ];
    let graderAttempt: DeepSeekResult;
    try {
      graderAttempt = await callDeepSeek(
        deepseekApiKey,
        graderPrompt.model,
        graderMessages,
        GRADER_MAX_TOKENS,
        true,
      );
    } catch (err) {
      outcome = "error";
      errorDetail = err instanceof Error ? err.message : "DeepSeek call failed";
      break attemptLoop;
    }
    if (!graderAttempt.ok) {
      outcome = "error";
      errorDetail = `DeepSeek API error: ${JSON.stringify(graderAttempt.detail)}`;
      break attemptLoop;
    }

    totalInputTokens += graderAttempt.inputTokens;
    totalOutputTokens += graderAttempt.outputTokens;
    let graderOutput = resolveGraderOutput(
      graderAttempt as DeepSeekSuccess,
      requiredCriteria,
    );

    if (!graderOutput) {
      logParseFailure("grader", 1, graderAttempt as DeepSeekSuccess);
      const firstFailure = captureGraderParseFailure(
        1,
        graderAttempt as DeepSeekSuccess,
      );
      graderParseFailureLog = [firstFailure];

      // finish_reason "length" means DeepSeek hit GRADER_MAX_TOKENS (or the
      // context window) mid-response -- the JSON is cut off mid-object, not
      // malformed by syntax. Asking it to "return only the JSON object"
      // again doesn't address that: the ceiling is unchanged and the
      // conversation is now longer (original prompt + the cut-off response),
      // so it's more likely to run out of room again, not less. Ask for a
      // shorter response instead. Any other finish_reason (stop,
      // content_filter, etc.) means generation finished normally but the
      // output was bad JSON or the wrong shape -- the original correction is
      // still the right ask for that case.
      const correctionMessage =
        firstFailure.finish_reason === "length"
          ? "Your last response was cut off before it finished — it hit the output length limit, not a JSON syntax problem. Return the JSON object again, but keep every issue's \"problem\" and \"suggested_fix\" to one short sentence each so the full object fits within the limit."
          : "Your last response was not valid JSON. Return only the JSON object.";

      graderMessages.push({
        role: "assistant",
        content: graderAttempt.content || graderAttempt.reasoningContent || "",
      });
      graderMessages.push({
        role: "user",
        content: correctionMessage,
      });
      let graderRetry: DeepSeekResult;
      try {
        graderRetry = await callDeepSeek(
          deepseekApiKey,
          graderPrompt.model,
          graderMessages,
          GRADER_MAX_TOKENS,
          true,
        );
      } catch (err) {
        outcome = "error";
        errorDetail =
          err instanceof Error ? err.message : "DeepSeek call failed";
        break attemptLoop;
      }
      if (!graderRetry.ok) {
        outcome = "error";
        errorDetail = `DeepSeek API error: ${JSON.stringify(graderRetry.detail)}`;
        break attemptLoop;
      }
      totalInputTokens += graderRetry.inputTokens;
      totalOutputTokens += graderRetry.outputTokens;
      graderOutput = resolveGraderOutput(
        graderRetry as DeepSeekSuccess,
        requiredCriteria,
      );
      if (!graderOutput) {
        logParseFailure("grader", 2, graderRetry as DeepSeekSuccess);
        graderParseFailureLog = [
          firstFailure,
          captureGraderParseFailure(2, graderRetry as DeepSeekSuccess),
        ];
      }
    }

    if (!graderOutput) {
      outcome = "error";
      errorDetail =
        "DeepSeek grader did not return valid, complete JSON after one retry";
      break attemptLoop;
    }

    const recomputedTotal = recomputeWeightedTotal(
      graderOutput.scores,
      rubricRow.criteria,
    );
    const lowScoreCriterion = findLowScoreCriterion(
      graderOutput.scores,
      rubricRow.criteria,
    );

    // ---- lint stage: deterministic checks, run as their own explicit
    // step now that the grader has returned. Same 7 checks as before,
    // same order, same messages -- see runLintChecks in pipelineShared.ts. ----
    const lintResult = runLintChecks(
      {
        body_markdown: writerOutput.body_markdown,
        meta_description: writerOutput.meta_description,
        hero_image_alt: writerOutput.hero_image_alt,
        sources: writerOutput.sources,
      },
      {
        title: establishedTitle,
        targetKeyword: input.target_keyword,
        validInternalLinkSlugs,
        bannedWords: profile.banned_words ?? [],
        similarityCandidates,
        contentShape,
      },
    );

    const hardFailReason =
      graderOutput.hard_fail_reason ??
      (lowScoreCriterion
        ? `auto-fail: ${lowScoreCriterion.name} scored ${graderOutput.scores[lowScoreCriterion.name]}/5`
        : null) ??
      lintResult.hardFailReason;
    const passed =
      recomputedTotal >= rubricRow.pass_threshold && !hardFailReason;

    // lintResult.infoIssues (e.g. an overlength title/meta_description) is
    // appended here, for storage and for the reviewer to see -- never fed
    // into previousIssues below, so it never reaches the reviser prompt.
    // It's informational only and must never look like something the next
    // attempt is expected to fix.
    const issuesForReviewer = [...graderOutput.issues, ...lintResult.infoIssues];

    const gradeResult = await insertGrade(supabaseAdmin, {
      draft_id: draftId,
      scores: graderOutput.scores,
      weighted_total: recomputedTotal,
      passed,
      hard_fail_reason: hardFailReason,
      issues: issuesForReviewer,
      verdict_summary: graderOutput.verdict_summary,
      rubric_id: rubricRow.id,
      prompt_id: graderPrompt.id,
      model: graderPrompt.model,
      input_tokens: graderAttempt.inputTokens,
      output_tokens: graderAttempt.outputTokens,
    });

    if ("errorMessage" in gradeResult) {
      outcome = "error";
      errorDetail = `Could not save grade: ${gradeResult.errorMessage}`;
      break attemptLoop;
    }

    if (firstScore === null) {
      firstScore = recomputedTotal;
    }

    const result: AttemptResult = {
      draftId,
      weightedTotal: recomputedTotal,
      passed,
      hardFailReason,
      issues: issuesForReviewer,
      bodyMarkdown: writerOutput.body_markdown,
    };

    if (isBetter(result, best)) {
      best = result;
    }

    if (passed) {
      outcome = "passed";
      break attemptLoop;
    }

    if (attemptNumber === MAX_ATTEMPTS) {
      outcome = "failed_after_retries";
      break attemptLoop;
    }

    // set up for the next attempt's revision
    previousDraftBody = writerOutput.body_markdown;
    previousIssues = graderOutput.issues;
    previousScore = recomputedTotal;
    previousHardFailReason = hardFailReason;
  }

  // ---- article always ends at needs_review; a human decides what happens next ----
  const { error: statusUpdateError } = await supabaseAdmin
    .from("articles")
    .update({ status: "needs_review" })
    .eq("id", article.id);

  if (statusUpdateError) {
    console.warn(
      `loop run for article ${article.id}: could not update status to needs_review: ${statusUpdateError.message}`,
    );
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const loopRunId = crypto.randomUUID();
  const { error: loopRunError } = await supabaseAdmin.from("loop_runs").insert({
    id: loopRunId,
    article_id: article.id,
    attempts_used: attemptsUsed,
    first_score: firstScore,
    final_score: best?.weightedTotal ?? null,
    best_draft_id: best?.draftId ?? null,
    outcome,
    error_detail: errorDetail,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost_cl: null,
    grader_parse_failures: graderParseFailureLog,
    duration_ms: durationMs,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
  });

  if (loopRunError) {
    console.warn(
      `Could not save loop_runs row for article ${article.id}: ${loopRunError.message}`,
    );
  }

  // ---- Phase 6: notify n8n so it can route on outcome and message Telegram ----
  // Does nothing if N8N_WEBHOOK_URL isn't set yet. Never blocks or fails this
  // response — a notification problem is not a pipeline problem.
  await notifyN8n({
    loop_run_id: loopRunId,
    article_id: article.id,
    site_id: siteRow.id,
    site_name: siteRow.name,
    title: establishedTitle,
    outcome,
    attempts_used: attemptsUsed,
    first_score: firstScore,
    final_score: best?.weightedTotal ?? null,
    best_draft_id: best?.draftId ?? null,
    error_detail: errorDetail,
  });

  if (outcome === "error") {
    return NextResponse.json(
      {
        error: errorDetail,
        article_id: article.id,
        attempts_used: attemptsUsed,
        best_draft_id: best?.draftId ?? null,
        loop_run_id: loopRunId,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    article_id: article.id,
    loop_run_id: loopRunId,
    outcome,
    attempts_used: attemptsUsed,
    first_score: firstScore,
    final_score: best?.weightedTotal ?? null,
    best_draft_id: best?.draftId ?? null,
    tokens: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    },
    duration_ms: durationMs,
    warnings,
  });
}
