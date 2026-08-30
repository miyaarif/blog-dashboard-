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
  formatRubricText,
  fillTemplate,
  daysSince,
  callDeepSeek,
  WRITER_MAX_TOKENS,
  GRADER_MAX_TOKENS,
  ChatMessage,
  DeepSeekResult,
  DeepSeekSuccess,
  parseWriterOutput,
  WriterOutput,
  resolveGraderOutput,
  logParseFailure,
  recomputeWeightedTotal,
  findLowScoreCriterion,
  insertArticleWithRetry,
  insertArticleBrands,
  insertDraft,
  insertGrade,
  notifyN8n,
} from "@/lib/pipelineShared";

const MAX_ATTEMPTS = 3;

// ------------------------------------------------------------
// Input shape — same as /api/generate
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
// Prompt loading — site-specific first, generic fallback.
// Same pattern used by /api/generate and /api/grade, factored locally
// since this route needs it for three different roles.
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

  // ---- site, brand profile, brands (same checks as /api/generate) ----
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
      "tone,reading_level,person,sentence_rhythm,use_contractions,use_em_dashes,structure_rules,heading_style,opening_style,cta_style,banned_words,mandatory_elements,must_avoid,typical_word_count",
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

  // ---- the loop ----
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let firstScore: number | null = null;
  let best: AttemptResult | null = null;
  let outcome: "passed" | "failed_after_retries" | "error" =
    "failed_after_retries";
  let errorDetail: string | null = null;
  let attemptsUsed = 0;

  let previousDraftBody: string | null = null;
  let previousIssues: Issue[] = [];
  let previousScore = 0;
  let previousHardFailReason: string | null = null;

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
        opening_style: profile.opening_style ?? "",
        cta_style: profile.cta_style ?? "",
        typical_word_count: profile.typical_word_count?.toString() ?? "",
        banned_words: (profile.banned_words ?? []).join(", "),
        mandatory_elements: formatBulletList(profile.mandatory_elements),
        must_avoid: profile.must_avoid ?? "",
        brand_facts: formatBrandFacts(brands),
        title: input.title,
        target_keyword: input.target_keyword,
        search_intent: input.search_intent,
        keywords: input.keywords.join(", "),
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
        opening_style: profile.opening_style ?? "",
        cta_style: profile.cta_style ?? "",
        typical_word_count: profile.typical_word_count?.toString() ?? "",
        banned_words: (profile.banned_words ?? []).join(", "),
        mandatory_elements: formatBulletList(profile.mandatory_elements),
        must_avoid: profile.must_avoid ?? "",
        brand_facts: formatBrandFacts(brands),
        title: input.title,
        target_keyword: input.target_keyword,
        search_intent: input.search_intent,
        keywords: input.keywords.join(", "),
        previous_draft: previousDraftBody ?? "",
        previous_score: String(previousScore),
        pass_threshold: String(rubricRow.pass_threshold),
        hard_fail_note: hardFailNote,
        issues: formatIssuesForReviser(previousIssues),
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

    // ---- save this attempt as a new draft version ----
    const wordCount = countWords(writerOutput.body_markdown);
    const finalSlug = isNonEmptyString(writerOutput.slug)
      ? slugify(writerOutput.slug)
      : slugify(input.title);

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
      title: input.title,
      target_keyword: input.target_keyword,
      typical_word_count: profile.typical_word_count?.toString() ?? "",
      draft: writerOutput.body_markdown,
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
      graderMessages.push({
        role: "assistant",
        content: graderAttempt.content || graderAttempt.reasoningContent || "",
      });
      graderMessages.push({
        role: "user",
        content:
          "Your last response was not valid JSON. Return only the JSON object.",
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
    const hardFailReason =
      graderOutput.hard_fail_reason ??
      (lowScoreCriterion
        ? `auto-fail: ${lowScoreCriterion.name} scored ${graderOutput.scores[lowScoreCriterion.name]}/5`
        : null);
    const passed =
      recomputedTotal >= rubricRow.pass_threshold && !hardFailReason;

    const gradeResult = await insertGrade(supabaseAdmin, {
      draft_id: draftId,
      scores: graderOutput.scores,
      weighted_total: recomputedTotal,
      passed,
      hard_fail_reason: hardFailReason,
      issues: graderOutput.issues,
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
      issues: graderOutput.issues,
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
    title: input.title,
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
