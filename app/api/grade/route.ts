import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  SiteRow,
  BrandProfileRow,
  BrandRow,
  RubricCriterion,
  RubricRow,
  PromptRow,
  isNonEmptyString,
  formatBulletList,
  formatBrandFacts,
  formatBrandProfileText,
  formatRubricText,
  fillTemplate,
  callDeepSeek,
  GRADER_MAX_TOKENS,
  ChatMessage,
  DeepSeekResult,
  DeepSeekSuccess,
  resolveGraderOutput,
  logParseFailure,
  recomputeWeightedTotal,
  findLowScoreCriterion,
  insertGrade,
} from "@/lib/pipelineShared";

// ------------------------------------------------------------
// Input shape
// ------------------------------------------------------------
interface GradeRequestBody {
  draft_id: string;
}

interface DraftRow {
  id: string;
  article_id: string;
  body_markdown: string;
}

interface ArticleRow {
  id: string;
  site_id: string;
  title: string;
  target_keyword: string;
}

function validateBody(body: unknown): {
  error: string | null;
  value: GradeRequestBody | null;
} {
  if (typeof body !== "object" || body === null) {
    return { error: "Request body must be a JSON object", value: null };
  }
  const candidate = body as Record<string, unknown>;
  if (!isNonEmptyString(candidate.draft_id)) {
    return { error: "draft_id is required", value: null };
  }
  return { error: null, value: { draft_id: candidate.draft_id } };
}

// ------------------------------------------------------------
// Route
// ------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const { error: bodyError, value: input } = validateBody(rawBody);
  if (!input) {
    return NextResponse.json({ error: bodyError }, { status: 400 });
  }

  // ---- refuse if this draft is already graded ----
  const { data: existingGrade, error: existingGradeError } = await supabaseAdmin
    .from("grades")
    .select("id")
    .eq("draft_id", input.draft_id)
    .maybeSingle();

  if (existingGradeError) {
    return NextResponse.json(
      { error: "Could not check for an existing grade" },
      { status: 500 },
    );
  }
  if (existingGrade) {
    return NextResponse.json(
      { error: "Draft already graded", grade_id: existingGrade.id as string },
      { status: 409 },
    );
  }

  // ---- load the draft, its article, site, brand profile, brands ----
  const { data: draft, error: draftError } = await supabaseAdmin
    .from("drafts")
    .select("id,article_id,body_markdown")
    .eq("id", input.draft_id)
    .maybeSingle();

  if (draftError) {
    return NextResponse.json(
      { error: "Could not load draft" },
      { status: 500 },
    );
  }
  if (!draft) {
    return NextResponse.json({ error: "Unknown draft_id" }, { status: 404 });
  }
  const draftRow = draft as DraftRow;

  const { data: article, error: articleError } = await supabaseAdmin
    .from("articles")
    .select("id,site_id,title,target_keyword")
    .eq("id", draftRow.article_id)
    .maybeSingle();

  if (articleError) {
    return NextResponse.json(
      { error: "Could not load article" },
      { status: 500 },
    );
  }
  if (!article) {
    return NextResponse.json(
      { error: "Draft's article no longer exists" },
      { status: 404 },
    );
  }
  const articleRow = article as ArticleRow;

  const { data: site, error: siteError } = await supabaseAdmin
    .from("sites")
    .select("id,name,content_profile")
    .eq("id", articleRow.site_id)
    .maybeSingle();

  if (siteError) {
    return NextResponse.json({ error: "Could not load site" }, { status: 500 });
  }
  if (!site) {
    return NextResponse.json(
      { error: "Article's site no longer exists" },
      { status: 404 },
    );
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

  const { data: joinRows, error: joinError } = await supabaseAdmin
    .from("article_brands")
    .select("brand_id")
    .eq("article_id", articleRow.id)
    .order("position", { ascending: true });

  if (joinError) {
    return NextResponse.json(
      { error: "Could not load article_brands" },
      { status: 500 },
    );
  }

  const brandIds = (joinRows ?? []).map((row) => row.brand_id as string);
  let brands: BrandRow[] = [];
  if (brandIds.length > 0) {
    const { data: brandRows, error: brandsError } = await supabaseAdmin
      .from("brands")
      .select(
        "id,name,what_they_are,strengths,weaknesses,eligibility,product_range,rate_note",
      )
      .in("id", brandIds);

    if (brandsError) {
      return NextResponse.json(
        { error: "Could not load brands" },
        { status: 500 },
      );
    }
    brands = (brandRows ?? []) as BrandRow[];
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

  // ---- active grader prompt, site-specific first, generic fallback ----
  const { data: specificPrompt, error: specificPromptError } =
    await supabaseAdmin
      .from("prompts")
      .select("id,body,model")
      .eq("role", "grader")
      .is("variant", null)
      .eq("content_profile", siteRow.content_profile)
      .eq("active", true)
      .maybeSingle();

  if (specificPromptError) {
    return NextResponse.json(
      { error: "Could not load grader prompt" },
      { status: 500 },
    );
  }

  let prompt = specificPrompt as PromptRow | null;

  if (!prompt) {
    const { data: genericPrompt, error: genericPromptError } =
      await supabaseAdmin
        .from("prompts")
        .select("id,body,model")
        .eq("role", "grader")
        .is("variant", null)
        .is("content_profile", null)
        .eq("active", true)
        .maybeSingle();

    if (genericPromptError) {
      return NextResponse.json(
        { error: "Could not load grader prompt" },
        { status: 500 },
      );
    }
    prompt = genericPrompt as PromptRow | null;
  }

  if (!prompt) {
    return NextResponse.json(
      {
        error: `no active grader prompt for content_profile '${siteRow.content_profile}'`,
      },
      { status: 400 },
    );
  }

  const requiredCriteria = rubricRow.criteria.map(
    (c: RubricCriterion) => c.name,
  );

  const resolvedPrompt = fillTemplate(prompt.body, {
    site_name: siteRow.name,
    brand_profile: formatBrandProfileText(profile),
    banned_words: (profile.banned_words ?? []).join(", "),
    brand_facts: formatBrandFacts(brands),
    rubric: formatRubricText(rubricRow.criteria),
    hard_fail_rules: formatBulletList(rubricRow.hard_fail_rules),
    pass_threshold: String(rubricRow.pass_threshold),
    title: articleRow.title,
    target_keyword: articleRow.target_keyword,
    typical_word_count: profile.typical_word_count?.toString() ?? "",
    draft: draftRow.body_markdown,
  });

  // ---- call the grader model, one retry if the JSON doesn't parse/validate ----
  const messages: ChatMessage[] = [{ role: "user", content: resolvedPrompt }];

  let attempt: DeepSeekResult;
  try {
    attempt = await callDeepSeek(
      deepseekApiKey,
      prompt.model,
      messages,
      GRADER_MAX_TOKENS,
      true,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "DeepSeek call failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!attempt.ok) {
    return NextResponse.json(
      { error: "DeepSeek API error", detail: attempt.detail },
      { status: attempt.status },
    );
  }

  let inputTokens = attempt.inputTokens;
  let outputTokens = attempt.outputTokens;
  let graderOutput = resolveGraderOutput(
    attempt as DeepSeekSuccess,
    requiredCriteria,
  );

  if (!graderOutput) {
    logParseFailure("grader", 1, attempt as DeepSeekSuccess);
    messages.push({
      role: "assistant",
      content: attempt.content || attempt.reasoningContent || "",
    });
    messages.push({
      role: "user",
      content:
        "Your last response was not valid JSON. Return only the JSON object.",
    });

    let retry: DeepSeekResult;
    try {
      retry = await callDeepSeek(
        deepseekApiKey,
        prompt.model,
        messages,
        GRADER_MAX_TOKENS,
        true,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "DeepSeek call failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    if (!retry.ok) {
      return NextResponse.json(
        { error: "DeepSeek API error", detail: retry.detail },
        { status: retry.status },
      );
    }

    inputTokens += retry.inputTokens;
    outputTokens += retry.outputTokens;
    graderOutput = resolveGraderOutput(
      retry as DeepSeekSuccess,
      requiredCriteria,
    );

    if (!graderOutput) {
      logParseFailure("grader", 2, retry as DeepSeekSuccess);
    }
  }

  if (!graderOutput) {
    // No equivalent of the writer's "keep the raw text" fallback here —
    // a grade row without real scores isn't useful. Create nothing.
    return NextResponse.json(
      {
        error:
          "DeepSeek grader did not return valid, complete JSON after one retry",
      },
      { status: 502 },
    );
  }

  // ---- recompute weighted_total ourselves; don't trust the model's math ----
  const recomputedTotal = recomputeWeightedTotal(
    graderOutput.scores,
    rubricRow.criteria,
  );
  if (recomputedTotal !== graderOutput.weighted_total) {
    console.warn(
      `grade mismatch for draft ${draftRow.id}: model said ${graderOutput.weighted_total}, recomputed ${recomputedTotal}`,
    );
  }

  // ---- server-side auto-fail floor: any criterion scoring <=2 is a hard ----
  // fail regardless of what the model itself decided. Falls back to the
  // model's own hard_fail_reason if it set one and no criterion is <=2.
  const lowScoreCriterion = findLowScoreCriterion(
    graderOutput.scores,
    rubricRow.criteria,
  );
  const hardFailReason =
    graderOutput.hard_fail_reason ??
    (lowScoreCriterion
      ? `auto-fail: ${lowScoreCriterion.name} scored ${graderOutput.scores[lowScoreCriterion.name]}/5`
      : null);

  if (lowScoreCriterion && !graderOutput.hard_fail_reason) {
    console.warn(
      `grade auto-fail for draft ${draftRow.id}: ${lowScoreCriterion.name} scored ` +
        `${graderOutput.scores[lowScoreCriterion.name]}/5, model did not set hard_fail_reason itself`,
    );
  }

  const passed = recomputedTotal >= rubricRow.pass_threshold && !hardFailReason;

  const gradeResult = await insertGrade(supabaseAdmin, {
    draft_id: draftRow.id,
    scores: graderOutput.scores,
    weighted_total: recomputedTotal,
    passed,
    hard_fail_reason: hardFailReason,
    issues: graderOutput.issues,
    verdict_summary: graderOutput.verdict_summary,
    rubric_id: rubricRow.id,
    prompt_id: prompt.id,
    model: prompt.model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });

  if ("errorMessage" in gradeResult) {
    if (gradeResult.code === "23505") {
      return NextResponse.json(
        { error: "Draft already graded" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: `Could not save grade: ${gradeResult.errorMessage}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    grade_id: gradeResult.id,
    weighted_total: recomputedTotal,
    passed,
    issue_count: graderOutput.issues.length,
  });
}
