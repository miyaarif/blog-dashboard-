import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// ------------------------------------------------------------
// Input shape
// ------------------------------------------------------------
interface GradeRequestBody {
  draft_id: string;
}

// ------------------------------------------------------------
// Row shapes — only the columns this route reads
// ------------------------------------------------------------
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

interface SiteRow {
  id: string;
  name: string;
  content_profile: string;
}

interface BrandProfileRow {
  tone: string;
  reading_level: string | null;
  person: string | null;
  sentence_rhythm: string | null;
  use_contractions: boolean;
  use_em_dashes: boolean;
  structure_rules: string | null;
  heading_style: string | null;
  opening_style: string | null;
  cta_style: string | null;
  banned_words: string[] | null;
  mandatory_elements: string[] | null;
  must_avoid: string | null;
  typical_word_count: number | null;
}

interface BrandRow {
  id: string;
  name: string;
  what_they_are: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  eligibility: string | null;
  product_range: string | null;
  rate_note: string | null;
}

interface RubricCriterion {
  name: string;
  weight: number;
  scale_1: string;
  scale_5: string;
}

interface RubricRow {
  id: string;
  criteria: RubricCriterion[];
  hard_fail_rules: string[];
  pass_threshold: number;
}

interface PromptRow {
  id: string;
  body: string;
  model: string;
}

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
// Formatting helpers for the prompt template
// ------------------------------------------------------------
function formatBulletList(items: string[] | null): string {
  if (!items || items.length === 0) return "- (none recorded)";
  return items.map((item) => `- ${item}`).join("\n");
}

function formatBrandProfileText(profile: BrandProfileRow): string {
  return [
    `Tone: ${profile.tone}`,
    `Reading level: ${profile.reading_level ?? "Not recorded."}`,
    `Person: ${profile.person ?? "Not recorded."}`,
    `Sentence rhythm: ${profile.sentence_rhythm ?? "Not recorded."}`,
    `Contractions: ${profile.use_contractions ? "yes" : "no"}`,
    `Em dashes: ${profile.use_em_dashes ? "yes" : "no"}`,
    `Structure: ${profile.structure_rules ?? "Not recorded."}`,
    `Headings: ${profile.heading_style ?? "Not recorded."}`,
    `Opening: ${profile.opening_style ?? "Not recorded."}`,
    `Closing: ${profile.cta_style ?? "Not recorded."}`,
    `Target length: about ${profile.typical_word_count ?? "an unspecified number of"} words`,
    `Must include:\n${formatBulletList(profile.mandatory_elements)}`,
    `Must avoid: ${profile.must_avoid ?? "Not recorded."}`,
  ].join("\n");
}

function formatBrandFacts(brands: BrandRow[]): string {
  if (brands.length === 0) {
    return "No partner brands for this article.";
  }
  return brands
    .map((brand) =>
      [
        brand.name,
        `What they are: ${brand.what_they_are ?? "Not recorded."}`,
        `Strengths:\n${formatBulletList(brand.strengths)}`,
        `Weaknesses:\n${formatBulletList(brand.weaknesses)}`,
        `Eligibility: ${brand.eligibility ?? "Not recorded."}`,
        `Product range: ${brand.product_range ?? "Not recorded."}`,
        `Rate note: ${brand.rate_note ?? "Not recorded."}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function formatRubricText(criteria: RubricCriterion[]): string {
  return criteria
    .map(
      (c) =>
        `${c.name} (weight ${c.weight}): 1 = ${c.scale_1} | 5 = ${c.scale_5}`,
    )
    .join("\n");
}

function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (match, key: string) => {
      return key in values ? values[key] : match;
    },
  );
}

// ------------------------------------------------------------
// DeepSeek — OpenAI-compatible chat completions
// ------------------------------------------------------------
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_TIMEOUT_MS = 120_000;
// A full grade (scores + one issue per weak criterion) needs ~3000 tokens
// of final JSON. deepseek-reasoner spends part of this same budget on
// reasoning_content before it ever writes the answer, so the ceiling has
// to cover reasoning + the final JSON, not just the JSON alone.
const GRADER_MAX_TOKENS = 8000;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DeepSeekSuccess {
  ok: true;
  content: string;
  reasoningContent: string | undefined;
  finishReason: string | undefined;
  usage: { prompt_tokens: number; completion_tokens: number };
  raw: unknown;
  inputTokens: number;
  outputTokens: number;
}

interface DeepSeekFailure {
  ok: false;
  status: number;
  detail: unknown;
}

type DeepSeekResult = DeepSeekSuccess | DeepSeekFailure;

async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<DeepSeekResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: GRADER_MAX_TOKENS,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      return { ok: false, status: res.status, detail };
    }

    const data = (await res.json()) as {
      choices: {
        message: { content: string; reasoning_content?: string };
        finish_reason?: string;
      }[];
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      ok: true,
      content: data.choices[0].message.content,
      reasoningContent: data.choices[0].message.reasoning_content,
      finishReason: data.choices[0].finish_reason,
      usage: data.usage,
      raw: data,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ------------------------------------------------------------
// Grader output — the JSON the grader prompt asks DeepSeek for
// ------------------------------------------------------------
interface Issue {
  criterion: string;
  severity: string;
  quote: string;
  problem: string;
  suggested_fix: string;
}

interface GraderOutput {
  scores: Record<string, number>;
  weighted_total: number;
  passed: boolean;
  hard_fail_reason: string | null;
  issues: Issue[];
  verdict_summary: string;
}

function isIssue(value: unknown): value is Issue {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.criterion === "string" &&
    typeof v.severity === "string" &&
    typeof v.quote === "string" &&
    typeof v.problem === "string" &&
    typeof v.suggested_fix === "string"
  );
}

// Requires every rubric criterion to be present in scores (step 8) as
// part of the same shape check the writer uses for its own JSON.
function isGraderOutput(
  value: unknown,
  requiredCriteria: string[],
): value is GraderOutput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  if (typeof v.scores !== "object" || v.scores === null) return false;
  const scores = v.scores as Record<string, unknown>;
  for (const name of requiredCriteria) {
    if (typeof scores[name] !== "number") return false;
  }

  if (typeof v.weighted_total !== "number") return false;
  if (typeof v.passed !== "boolean") return false;
  if (v.hard_fail_reason !== null && typeof v.hard_fail_reason !== "string")
    return false;
  if (!Array.isArray(v.issues) || !v.issues.every(isIssue)) return false;
  if (typeof v.verdict_summary !== "string") return false;

  return true;
}

// Strips ```json fences, then takes the substring from the first { to the
// last } — same approach as the writer route.
function extractJsonObject(raw: string): string | null {
  const withoutFences = raw.replace(/```json/gi, "").replace(/```/g, "");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return withoutFences.slice(start, end + 1);
}

function parseGraderOutput(
  raw: string | undefined,
  requiredCriteria: string[],
): GraderOutput | null {
  if (!raw) return null;
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  return isGraderOutput(parsed, requiredCriteria) ? parsed : null;
}

// deepseek-reasoner sometimes leaves `content` empty and puts everything —
// including, at times, the final answer — in reasoning_content instead.
// Try the normal field first, then fall back to reasoning_content.
function resolveGraderOutput(
  result: DeepSeekSuccess,
  requiredCriteria: string[],
): GraderOutput | null {
  return (
    parseGraderOutput(result.content, requiredCriteria) ??
    parseGraderOutput(result.reasoningContent, requiredCriteria)
  );
}

// Never log the draft body — this logs the grader's own reply, not the
// draft it was reviewing. finish_reason=="length" means it ran out of
// max_tokens, which for a reasoning model can happen mid-thought, before
// it ever writes `content`.
function logParseFailure(attemptNumber: number, result: DeepSeekSuccess): void {
  console.warn(
    `grader parse failure (attempt ${attemptNumber}): finish_reason=${result.finishReason ?? "unknown"} ` +
      `content_length=${result.content?.length ?? 0} reasoning_content_length=${result.reasoningContent?.length ?? 0} ` +
      `usage=${JSON.stringify(result.usage)}`,
  );
  console.warn(
    `grader full response (attempt ${attemptNumber}): ${JSON.stringify(result.raw)}`,
  );
}

function recomputeWeightedTotal(
  scores: Record<string, number>,
  criteria: RubricCriterion[],
): number {
  const total = criteria.reduce(
    (sum, c) => sum + (scores[c.name] / 5) * c.weight,
    0,
  );
  return Math.round(total);
}

// Server-side floor: if any rubric criterion scored 2 or below, this is an
// automatic hard fail regardless of the weighted total or what the model
// itself decided to put in hard_fail_reason. This is pure arithmetic on
// scores we already have — it must not depend on the model remembering to
// apply the rule from the prompt text, same reasoning as why we recompute
// weighted_total instead of trusting the model's math.
function findLowScoreCriterion(
  scores: Record<string, number>,
  criteria: RubricCriterion[],
): RubricCriterion | null {
  for (const c of criteria) {
    const score = scores[c.name];
    if (typeof score === "number" && score <= 2) {
      return c;
    }
  }
  return null;
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

  const requiredCriteria = rubricRow.criteria.map((c) => c.name);

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
    attempt = await callDeepSeek(deepseekApiKey, prompt.model, messages);
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
  let graderOutput = resolveGraderOutput(attempt, requiredCriteria);

  if (!graderOutput) {
    logParseFailure(1, attempt);
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
      retry = await callDeepSeek(deepseekApiKey, prompt.model, messages);
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
    graderOutput = resolveGraderOutput(retry, requiredCriteria);

    if (!graderOutput) {
      logParseFailure(2, retry);
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

  const { data: insertedGrade, error: insertError } = await supabaseAdmin
    .from("grades")
    .insert({
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
      cost_cl: null,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Draft already graded" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: `Could not save grade: ${insertError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    grade_id: insertedGrade.id as string,
    weighted_total: recomputedTotal,
    passed,
    issue_count: graderOutput.issues.length,
  });
}
