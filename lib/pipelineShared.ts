import { SupabaseClient } from "@supabase/supabase-js";
import { parseArticleBody } from "./blogContent";
import { TITLE_MAX_CHARS, DESCRIPTION_MAX_CHARS } from "./blogMetadata";

// ------------------------------------------------------------
// Shared row shapes
// ------------------------------------------------------------
export interface SiteRow {
  id: string;
  name: string;
  domain: string;
  vertical: string | null;
  audience: string | null;
  monetisation: string | null;
  content_profile: string;
}

export interface TerminologyEntry {
  term: string;
  real_meaning: string;
}

export interface BrandProfileRow {
  tone: string;
  reading_level: string | null;
  person: string | null;
  sentence_rhythm: string | null;
  use_contractions: boolean;
  use_em_dashes: boolean;
  structure_rules: string | null;
  heading_style: string | null;
  heading_case: string | null;
  opening_style: string | null;
  cta_style: string | null;
  banned_words: string[] | null;
  mandatory_elements: string[] | null;
  must_avoid: string | null;
  typical_word_count: number | null;
  terminology: TerminologyEntry[] | null;
}

export interface BrandRow {
  id: string;
  name: string;
  what_they_are: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  eligibility: string | null;
  product_range: string | null;
  rate_note: string | null;
  last_verified_at?: string | null;
  active?: boolean;
}

export interface RubricCriterion {
  name: string;
  weight: number;
  scale_1: string;
  scale_5: string;
}

export interface RubricRow {
  id: string;
  criteria: RubricCriterion[];
  hard_fail_rules: string[];
  pass_threshold: number;
}

export interface PromptRow {
  id: string;
  body: string;
  model: string;
}

export const STALE_AFTER_DAYS = 90;

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

// ------------------------------------------------------------
// Formatting helpers for prompt templates
// ------------------------------------------------------------
export function formatBulletList(items: string[] | null): string {
  if (!items || items.length === 0) return "- (none recorded)";
  return items.map((item) => `- ${item}`).join("\n");
}

export function formatBrandFacts(brands: BrandRow[]): string {
  if (brands.length === 0) {
    return "No partner brands for this article. Write on the site's own authority, no affiliate brand facts to include.";
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

export function formatTerminology(terminology: TerminologyEntry[] | null): string {
  if (!terminology || terminology.length === 0) return "(none recorded)";
  return terminology
    .map((t) => `- "${t.term}" really means: ${t.real_meaning}`)
    .join("\n");
}

export function formatBrandProfileText(profile: BrandProfileRow): string {
  return [
    `Tone: ${profile.tone}`,
    `Reading level: ${profile.reading_level ?? "Not recorded."}`,
    `Person: ${profile.person ?? "Not recorded."}`,
    `Sentence rhythm: ${profile.sentence_rhythm ?? "Not recorded."}`,
    `Contractions: ${profile.use_contractions ? "yes" : "no"}`,
    `Em dashes: ${profile.use_em_dashes ? "yes" : "no"}`,
    `Structure: ${profile.structure_rules ?? "Not recorded."}`,
    `Headings: ${profile.heading_style ?? "Not recorded."}`,
    `Heading case rule: ${profile.heading_case ?? "Not recorded."}`,
    `Opening: ${profile.opening_style ?? "Not recorded."}`,
    `Closing: ${profile.cta_style ?? "Not recorded."}`,
    `Target length: about ${profile.typical_word_count ?? "an unspecified number of"} words`,
    `Must include:\n${formatBulletList(profile.mandatory_elements)}`,
    `Must avoid: ${profile.must_avoid ?? "Not recorded."}`,
    `Terminology this site uses differently than the general meaning:\n${formatTerminology(profile.terminology)}`,
  ].join("\n");
}

export function formatRubricText(criteria: RubricCriterion[]): string {
  return criteria
    .map(
      (c) =>
        `${c.name} (weight ${c.weight}): 1 = ${c.scale_1} | 5 = ${c.scale_5}`,
    )
    .join("\n");
}

export function fillTemplate(
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
// Content shape — what kind of article this actually is, so the writer
// and grader stop forcing a comparison/recommendation structure onto
// topics with nothing to compare. Deterministic from data already on
// hand at generation time (verified brand count + operator-set search
// intent) — no extra model call, no new classification step.
// ------------------------------------------------------------
export type ContentShape =
  | "comparison"
  | "single_brand"
  | "buying_guide"
  | "explainer";

export function classifyContentShape(
  brandCount: number,
  searchIntent: string,
): ContentShape {
  if (brandCount >= 2) return "comparison";
  if (brandCount === 1) return "single_brand";
  return searchIntent === "informational" ? "explainer" : "buying_guide";
}

export function daysSince(
  dateString: string | null | undefined,
): number | null {
  if (!dateString) return null;
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

// ------------------------------------------------------------
// DeepSeek — OpenAI-compatible chat completions
// ------------------------------------------------------------
export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_TIMEOUT_MS = 300_000;
// A full grade (scores + one issue per weak criterion) needs ~3000 tokens
// of final JSON. deepseek-reasoner spends part of this same budget on
// reasoning_content before it ever writes the answer, so the ceiling has
// to cover reasoning + the final JSON, not just the JSON alone.
//
// Raised 20000 -> 30000 for grader v11's fact_grounding_audit (Fix 8 part
// 1): real output_tokens were already hitting 19095/20000 on some v10
// grades before this field existed, and a direct test of v11 against a
// real draft hit the 20000 ceiling exactly and truncated mid-JSON. This
// is a real added cost of the audit-trail field, not a free change --
// more completion tokens, not a new call.
export const GRADER_MAX_TOKENS = 30000;
export const WRITER_MAX_TOKENS = 4000;
// The outline call returns a section skeleton (headings + short planning
// notes), not full prose -- a fraction of a full draft's output size.
export const OUTLINE_MAX_TOKENS = 2500;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DeepSeekSuccess {
  ok: true;
  content: string;
  reasoningContent: string | undefined;
  finishReason: string | undefined;
  usage: { prompt_tokens: number; completion_tokens: number };
  raw: unknown;
  inputTokens: number;
  outputTokens: number;
}

export interface DeepSeekFailure {
  ok: false;
  status: number;
  detail: unknown;
}

export type DeepSeekResult = DeepSeekSuccess | DeepSeekFailure;

export async function callDeepSeek(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  useJsonMode: boolean,
): Promise<DeepSeekResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS);

  try {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    };
    if (useJsonMode) {
      body.response_format = { type: "json_object" };
    }

    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
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
// JSON extraction — shared by writer and grader parsing
// ------------------------------------------------------------
// Strips ```json fences, then takes the substring from the first { to the
// last } — both the writer and grader sometimes wrap otherwise-valid JSON
// in commentary or code fences.
export function extractJsonObject(raw: string): string | null {
  const withoutFences = raw.replace(/```json/gi, "").replace(/```/g, "");
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return withoutFences.slice(start, end + 1);
}

// ------------------------------------------------------------
// Writer output
// ------------------------------------------------------------
export interface WriterOutput {
  title: string;
  body_markdown: string;
  meta_description: string;
  slug: string;
  hero_image_alt: string;
  sources: string[];
  internal_links: string[];
}

export function isWriterOutput(value: unknown): value is WriterOutput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === "string" &&
    typeof v.body_markdown === "string" &&
    typeof v.meta_description === "string" &&
    typeof v.slug === "string" &&
    typeof v.hero_image_alt === "string" &&
    isStringArray(v.sources) &&
    isStringArray(v.internal_links)
  );
}

export function parseWriterOutput(raw: string): WriterOutput | null {
  const jsonText = extractJsonObject(raw);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  return isWriterOutput(parsed) ? parsed : null;
}

// ------------------------------------------------------------
// Grader output
// ------------------------------------------------------------
export interface Issue {
  criterion: string;
  severity: string;
  quote: string;
  problem: string;
  suggested_fix: string;
}

export interface GraderOutput {
  scores: Record<string, number>;
  weighted_total: number;
  passed: boolean;
  hard_fail_reason: string | null;
  issues: Issue[];
  verdict_summary: string;
}

export function isIssue(value: unknown): value is Issue {
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

// Requires every rubric criterion to be present in scores as part of the
// same shape check the writer uses for its own JSON.
export function isGraderOutput(
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

export function parseGraderOutput(
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
export function resolveGraderOutput(
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
export function logParseFailure(
  label: string,
  attemptNumber: number,
  result: DeepSeekSuccess,
): void {
  console.warn(
    `${label} parse failure (attempt ${attemptNumber}): finish_reason=${result.finishReason ?? "unknown"} ` +
      `content_length=${result.content?.length ?? 0} reasoning_content_length=${result.reasoningContent?.length ?? 0} ` +
      `usage=${JSON.stringify(result.usage)}`,
  );
  console.warn(
    `${label} full response (attempt ${attemptNumber}): ${JSON.stringify(result.raw)}`,
  );
}

// A real occurrence of "DeepSeek grader did not return valid, complete
// JSON after one retry" (5 times, Sept 2026) left nothing behind but the
// console.warn lines above -- gone once the terminal/Vercel log rolled
// over. Every one was undiagnosable afterward: no raw response, no
// finish_reason, no per-call token usage survived. This builds the same
// data as a plain object the caller can persist (loop_runs.grader_parse_failures)
// instead of only logging it. finish_reason is the field that actually
// distinguishes "hit the token ceiling" (length) from "finished normally
// but produced bad JSON" (stop) -- confirmed against DeepSeek's own API
// docs, not assumed.
export interface GraderParseFailure {
  attempt: number;
  finish_reason: string | null;
  input_tokens: number;
  output_tokens: number;
  content: string;
  reasoning_content: string | null;
  captured_at: string;
}

export function captureGraderParseFailure(
  attempt: number,
  result: DeepSeekSuccess,
): GraderParseFailure {
  return {
    attempt,
    finish_reason: result.finishReason ?? null,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    content: result.content ?? "",
    reasoning_content: result.reasoningContent ?? null,
    captured_at: new Date().toISOString(),
  };
}

export function recomputeWeightedTotal(
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
// itself decided to put in hard_fail_reason. Pure arithmetic on scores we
// already have — it must not depend on the model remembering to apply the
// rule from the prompt text, same reasoning as why we recompute
// weighted_total instead of trusting the model's math.
export function findLowScoreCriterion(
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

// Server-side floor, same reasoning as findLowScoreCriterion: a leftover
// placeholder token must never depend on the grader model remembering to
// catch it. Checked directly against the writer's real output.
//
// [bracket] placeholders (e.g. "[PUBLISH DATE]", "[INSERT STATISTIC]") are
// excluded when immediately followed by "(" so real markdown links like
// "[ScholarRoads](https://...)" never false-positive. Verified against
// every real draft in production: zero false positives from real links,
// and it correctly catches all 9 real historical "[PUBLISH DATE]" /
// "[Month Year]" leftovers.
//
// TODO/TBD/XXX/INSERT are matched as whole words, case-insensitive, per
// spec. INSERT is also an ordinary English verb ("insert your card"), so
// this can in principle flag genuine prose — checked against every real
// draft in production and found zero such cases, so leaving it exactly as
// specified rather than narrowing it on a hypothetical.
// Fix 7 (manager feedback item 1.2) -- internal-process artifacts
// leaking into rendered output, same category of defect as the bracket
// and {{}} placeholders above. "Score:" is deliberately scoped to the
// real leak shape (a QA weighted_total out of 100, e.g. "Score:
// 90/100") rather than a bare "Score:" -- "credit score: 680+" is
// common, legitimate real phrasing in this content, and a credit score
// is never expressed as an N/100 fraction, so this can't collide with it.
const PLACEHOLDER_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "square-bracket placeholder", pattern: /\[[^[\]]{1,80}\](?!\()/ },
  { name: "template placeholder", pattern: /\{\{[^{}]{1,80}\}\}/ },
  { name: '"TODO"', pattern: /\bTODO\b/i },
  { name: '"TBD"', pattern: /\bTBD\b/i },
  { name: '"XXX"', pattern: /\bXXX\b/i },
  { name: '"INSERT"', pattern: /\bINSERT\b/i },
  { name: '"Score:" QA-metadata leak', pattern: /\bScore:\s*\d{1,3}\s*\/\s*100\b/i },
  // Real false positive found 2026-09-12: a genuine, on-topic HME article
  // about YouTube Shorts hard-failed 3/3 attempts on "AI-generated Shorts
  // aren't called out in YouTube's published Shorts monetization policies"
  // -- legitimate prose about a real platform-policy topic, not a leak. The
  // real original bug this rule exists for (manager feedback doc, section
  // 1.2) was the specific self-referential phrase "HME's first AI-generated
  // article" -- no longer present in any real stored row to test against
  // directly (confirmed: zero matches in articles or drafts), only known
  // from the doc's own quote. Narrowed to require "article" right after
  // "AI-generated" -- still catches the real historical phrase, no longer
  // collides with "AI-generated Shorts/content/video", which real articles
  // legitimately discuss as a topic, not a claim about themselves.
  { name: '"AI-generated" leak', pattern: /\bAI[\s-]generated\s+article\b/i },
  { name: '"placeholder" leak', pattern: /\bplaceholders?\b/i },
  { name: '"known bug" leak', pattern: /\bknown bug\b/i },
];

export function findPlaceholderLeftover(
  fields: Record<string, string | null | undefined>,
): string | null {
  for (const [fieldName, text] of Object.entries(fields)) {
    if (!text) continue;
    for (const { name, pattern } of PLACEHOLDER_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return `${name} left in ${fieldName}: "${match[0]}"`;
      }
    }
  }
  return null;
}

// Server-side floor, same reasoning as findPlaceholderLeftover: whether
// the title/keyword promises a real figure and whether the body actually
// has one must not depend on the grader model remembering to check —
// same real bug as the original manager-feedback example (HME's "What
// Sponsored Video Production Actually Costs" scored 93/100 with zero $
// or % anywhere in the body). Mirrors writer v8 rule 18 / grader v4 rule
// 13's word list ("cost", "how much", "price", "rate", "fee"), extended
// with the other signal words explicitly requested here (percent/%,
// cheap/cheapest, expensive) — kept identical to the prompt-level rules
// on purpose, so the soft instruction and the hard gate agree on what
// counts as a promise.
const TITLE_PROMISE_SIGNAL_WORDS: { label: string; pattern: RegExp }[] = [
  { label: '"cost"/"costs"', pattern: /\bcosts?\b/i },
  { label: '"price"/"prices"/"priced"/"pricing"', pattern: /\bpric(?:e|es|ed|ing)\b/i },
  { label: '"how much"', pattern: /\bhow much\b/i },
  { label: '"rate"/"rates"', pattern: /\brates?\b/i },
  { label: '"fee"/"fees"', pattern: /\bfees?\b/i },
  { label: '"percent"/"percentage"/"%"', pattern: /\bpercent(?:age)?\b|%/i },
  { label: '"cheap"/"cheapest"', pattern: /\bcheap(?:est)?\b/i },
  { label: '"expensive"', pattern: /\bexpensive\b/i },
];

// A real figure: a dollar amount ($5,000 / $5,000.50 / $5) or a
// percentage (87% / 12.5 %). Either one anywhere in the body satisfies
// the promise — this isn't checking placement or context, just whether
// a real number exists at all, same coarse-but-reliable approach as
// findPlaceholderLeftover.
const PROMISED_FIGURE_PATTERNS: RegExp[] = [
  /\$\s?\d[\d,]*(?:\.\d+)?/,
  /\b\d+(?:\.\d+)?\s?%/,
];

// Shared by findMissingPromisedFigures and findZeroGroundingOnComparison
// below -- one definition of "does this body contain a real figure at
// all", so the two checks can't quietly drift apart.
function hasAnyFigure(body: string): boolean {
  return PROMISED_FIGURE_PATTERNS.some((pattern) => pattern.test(body));
}

export function findMissingPromisedFigures(
  title: string,
  targetKeyword: string,
  body: string,
): string | null {
  const titleAndKeyword = `${title} ${targetKeyword}`;
  const matchedSignal = TITLE_PROMISE_SIGNAL_WORDS.find(({ pattern }) =>
    pattern.test(titleAndKeyword),
  );
  if (!matchedSignal) return null; // title/keyword doesn't promise a figure

  if (hasAnyFigure(body)) return null;

  return `title/keyword promises a figure (matched ${matchedSignal.label}) but the body contains no dollar amount or percentage`;
}

// Server-side floor, same reasoning as the two checks above: whether a
// linked slug is real must not depend on the writer model remembering
// not to invent one. Only checks for a FABRICATED link — a real slug
// used that wasn't in the candidate list actually given to this
// attempt. Zero real internal links is handled separately, by
// findInsufficientInternalLinks below.
const INTERNAL_LINK_PATTERN = /\]\(\/blog\/([a-z0-9-]+)\)/gi;

export function findInvalidInternalLinks(
  body: string,
  candidateSlugs: string[],
): string | null {
  const validSlugs = new Set(candidateSlugs);
  for (const match of body.matchAll(INTERNAL_LINK_PATTERN)) {
    const slug = match[1];
    if (!validSlugs.has(slug)) {
      return `internal link to "/blog/${slug}" does not match any real candidate slug given to the writer for this attempt`;
    }
  }
  return null;
}

// Manager feedback (Section 3): "require 3-5 contextual internal
// links." Real backstop, same server-side-floor reasoning as the
// checks above -- must not depend on the writer remembering the
// prompt's own "3 to 5" target (writer v15). Uses the manager's own
// number (3) as the floor, not a new invented one.
//
// Scoped, same discipline as findZeroGroundingOnComparison: never
// demands more real links than genuinely exist. A brand-new site (or
// an early article on one) with fewer than 3 real published articles
// to link to can't hit 3 without fabricating one -- effectiveMinimum
// caps at however many real candidates actually exist, and is 0 (no
// hard-fail at all) when there are none yet. Only counts links that
// are actually real (in candidateSlugs) toward the total -- a
// fabricated link doesn't count, and is separately hard-failed by
// findInvalidInternalLinks regardless of check order.
export const MINIMUM_INTERNAL_LINKS = 3;

export function findInsufficientInternalLinks(
  body: string,
  candidateSlugs: string[],
  minimum: number = MINIMUM_INTERNAL_LINKS,
): string | null {
  const effectiveMinimum = Math.min(minimum, candidateSlugs.length);
  if (effectiveMinimum === 0) return null;

  const validSlugs = new Set(candidateSlugs);
  const usedSlugs = new Set<string>();
  for (const match of body.matchAll(INTERNAL_LINK_PATTERN)) {
    if (validSlugs.has(match[1])) usedSlugs.add(match[1]);
  }
  if (usedSlugs.size >= effectiveMinimum) return null;

  return `only ${usedSlugs.size} real internal link(s) used, despite ${candidateSlugs.length} real candidate(s) available (target: at least ${effectiveMinimum})`;
}

// Server-side floor, same reasoning as the checks above: a fabricated
// "Reviewed by ... Updated ..." byline must not depend on the writer
// model remembering rule 14/8, and must be caught before publish, not
// just stripped at render time. Reuses the exact pattern already proven
// against every real draft in production by
// stripFabricatedByline() (lib/blogContent.ts) rather than inventing a
// new one — that function's own comment documents it correctly strips
// the real historical instances. Deliberately narrow: requires BOTH
// "reviewed by" and "updated" on the same line, so a real research
// citation like "published December 5, 2025" or "fetched September 10,
// 2026" (real text in real passing drafts, e.g. art_0105) never
// matches — neither word appears in those sentences.
const FABRICATED_BYLINE_PATTERN = /^.*\breviewed by\b.*\bupdated\b.*$/im;

export function findFabricatedByline(body: string): string | null {
  const match = body.match(FABRICATED_BYLINE_PATTERN);
  if (!match) return null;
  return `fabricated byline line found: "${match[0].trim()}"`;
}

// Server-side floor, same reasoning as the checks above: repetition
// must be caught deterministically, not left to the grader model to
// notice (rule 5's "flag every banned word" already asks it to, but
// nothing stops it from missing one).
//
// Phrase definition: an exact 6-word sliding window (normalized —
// lowercased, markdown stripped, punctuation stripped), flagged if the
// SAME window recurs 3+ times. 6 words is deliberately longer than any
// short keyword phrase this pipeline is supposed to repeat on purpose
// (e.g. "student loan grace period" is 4 words, "private student
// loan" is 3) — a real target keyword repeating naturally throughout
// an article never forms a full matching 6-word run unless the exact
// surrounding words repeat too, which real prose doesn't do by
// accident. The real banned phrases Fix 3a found ("here's how we think
// about it", "so which should you pick?") are both within one window
// of this size.
const PHRASE_WINDOW_SIZE = 6;
const PHRASE_REPETITION_THRESHOLD = 3;

// Paragraph-duplicate threshold matches the manager's own wording
// ("same compliance paragraph >1x") — 2 occurrences of a real
// paragraph-length block within the same article is already the
// defect, no need to wait for a 3rd. MIN_PARAGRAPH_WORDS keeps this
// checking real paragraphs (like a duplicated disclosure or the
// "exhaust federal aid first" note), not short bullets or headings
// that legitimately repeat short structural text.
const PARAGRAPH_REPETITION_THRESHOLD = 2;
const MIN_PARAGRAPH_WORDS = 12;

function normalizeForRepetitionCheck(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // markdown links -> anchor text only
    .replace(/[*_`#]/g, "") // strip markdown emphasis/heading markers
    .replace(/[^a-z0-9\s]/g, "") // strip remaining punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// Real testing (2026-09-11) found the single largest remaining
// findRepeatedPhrase false-positive cluster is the same real date
// cited in two different formats: research_facts stores it ISO
// ("2026-09-10"), the writer naturally writes it as prose ("September
// 10, 2026" or "Sept. 10, 2026"). After normalizeForRepetitionCheck's
// punctuation-stripping, "2026-09-10" glues into one token
// ("20260910") while the prose form stays three separate words
// ("september 10 2026") -- they can never match, in any word order,
// no matter how the surrounding text is paraphrased.
//
// Deliberately scoped to findRepeatedPhrase only -- must run BEFORE
// normalizeForRepetitionCheck (needs the real hyphens/periods/commas
// still present to recognize date patterns) and must NEVER touch
// findDuplicateParagraph, which already runs live in the real
// hard-fail chain today; changing its normalization would be a real
// behavior change to something already shipped, not a refinement to
// something still disconnected.
const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBREVIATIONS: Record<string, string> = {
  jan: "january", feb: "february", mar: "march", apr: "april",
  jun: "june", jul: "july", aug: "august", sep: "september",
  sept: "september", oct: "october", nov: "november", dec: "december",
};

function canonicalizeDates(text: string): string {
  let result = text.replace(
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    (match, year: string, month: string, day: string) => {
      const monthName = MONTH_NAMES[parseInt(month, 10) - 1];
      return monthName ? `${monthName} ${parseInt(day, 10)} ${year}` : match;
    },
  );
  result = result.replace(
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g,
    (match, monthRaw: string, day: string, year: string) => {
      const key = monthRaw.toLowerCase();
      const monthName = MONTH_NAMES.includes(key) ? key : MONTH_ABBREVIATIONS[key];
      return monthName ? `${monthName} ${parseInt(day, 10)} ${year}` : match;
    },
  );
  return result;
}

// findRepeatedPhrase() is still NOT wired into findRepetitionIssues/
// runLintChecks -- six real rounds of testing (2026-09-11/12) got this
// from a 49.1% real false-fail rate down to a validated 20.0%, with a
// regression found and reverted along the way. Recorded here in full so
// a future attempt doesn't have to rediscover any of it.
//
// Round 1: compare each repeated window against referenceText (the real
// supplied material for the assignment). Fixed the cleanest cases
// (art_0110's own target_keyword repeating; short verbatim terminology
// reuse) but required the FULL 6-word window to match verbatim, so any
// paraphrase of real supplied text still false-positived.
//
// Round 2: relaxed to any contiguous run of >=4 words, not the full
// window. Improved 56.4% -> 49.1%, but every remaining case still
// traced to real supplied facts, not invented filler -- two distinct
// root causes: (a) date-format mismatch (research_facts stores ISO
// dates, the writer writes prose dates -- different tokens even after
// normalizing) and (b) word-order/verb-form paraphrase sitting INSIDE
// the window (domain_facts "a co-borrower and a cosigner" reversed to
// "a cosigner and a coborrower"; "What they are: X" turned into "X is
// Y", changing the verb right where the window sits).
//
// Round 3: built canonicalizeDates() to fix (a). Verified it works
// correctly in isolation, but real re-test found ZERO improvement
// (still 49.1%) -- the real blocker wasn't the date TOKEN format, it
// was sentence adjacency: research_facts' citation lines put the URL
// next to the date ("...URL (fetched 2026-09-10)"), the writer
// naturally puts the brand name next to the date instead ("Spirit
// Juice Studios (fetched September 10, 2026)"). Same date, same
// tokens, different neighbor -- still no contiguous match. Kept
// canonicalizeDates anyway; it's correct and later rounds build on it.
//
// Round 4: replaced contiguous-substring grounding with component
// masking -- dates/figures/URLs/brand names/entity-like proper nouns
// get replaced with placeholder tokens (maskComponents), and a window
// that's mostly citation apparatus (isCitationShaped) is exempt only
// if the REAL underlying value behind each placeholder is identical
// across every occurrence (the value-consistency guard) -- so citing
// the same real source for different facts is fine, but a lazy
// template reused with different real numbers plugged in each time
// still gets caught. Improved 49.1% -> 38.2%. An adversarial test
// (invented filler sharing topical vocabulary with real reference
// material) confirmed the guard isn't just permissive noise.
//
// Round 5: replaced round 2's contiguous-substring grounding fallback
// with word-SET (order-independent, stopword-filtered) Jaccard overlap
// between the window and same-size sliding windows of referenceText
// (isGroundedByOverlap) -- catches word-order reversals and
// verb-form paraphrase that no contiguous run can bridge. Also added a
// structural zone exemption (isStructurallyExempt): quick_answer,
// key_takeaways, body (all H2/H3 sections collectively, ONE zone), and
// faq are four distinct real structural purposes (writer rules 8-11;
// rule 9 specifically requires a takeaway to be introduced once and
// explained in full later) -- a window touching >=2 distinct zones,
// with no single zone repeating it more than once internally, is
// exactly that mandated reinforcement, not filler. Improved 38.2% ->
// 20.0% (11/55), the best real result across all rounds -- confirmed:
// the synthetic invented-filler case still fires, the adversarial test
// still resists false exemption, and a spot-check of every remaining
// flagged case found only one clear genuine catch (art_0112's two
// byte-identical sentences) plus a few still-debatable ones -- zero
// confirmed invented filler was ever missed.
//
// Round 6 (tried and reverted): split the single "body" zone into one
// zone per real H2 section, to fix a specific remaining false positive
// (art_0138, a brand fact restated across two different body sections).
// Real re-test found this did NOT fix art_0138 (still flagged) AND
// introduced a real regression: art_0112's two identical sentences
// happen to sit in two different H2 sections, so finer zoning wrongly
// excused them as legitimate cross-zone reinforcement. Disabling zone
// exemption entirely (to isolate the effect) reverted to round 4's
// 38.2%, losing real value the coarse single-"body"-zone version was
// providing for the co-borrower/cosigner cluster. Conclusion: location
// is the wrong signal to distinguish "the same fact reworded" from
// "the same sentence duplicated," at any zone granularity -- reverted
// to round 5's coarse single-"body"-zone design, the best validated
// state.
const CITATION_MARKERS = new Set([
  "fetched", "per", "cited", "source", "sourced", "according", "reports", "as", "of", "report",
]);
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with",
  "is", "are", "was", "were", "be", "been", "being", "this", "that", "these", "those",
  "it", "its", "as", "your", "you", "not", "no", "do", "does", "did", "have", "has",
  "had", "will", "would", "can", "could", "should", "just", "also", "so", "if", "than", "then",
]);
const CITATION_SHAPE_THRESHOLD = 0.5;
const OVERLAP_GROUNDING_THRESHOLD = 0.6;

interface MaskResult {
  masked: string;
  valueById: Map<string, string>;
}

// Replaces real dates/figures/URLs/brand names/entity-like proper nouns
// with a UNIQUE indexed placeholder ("figuretoken3"), recording the
// real underlying value per placeholder. Figure masking covers $X, X%,
// and spelled-out percent ranges ("10 to 30 percent") -- real testing
// (art_0137) found the writer sometimes spells percent ranges out
// rather than using the % sign. The entity heuristic (2-4 consecutive
// Capitalized Words) is coarse but reliable, same spirit as this file's
// other regex-based checks -- it catches real research-cited company
// names that aren't in the verified brands table (e.g. "Storyteller
// Studios", cited as a data source, not an affiliate partner).
function maskGroundedComponents(rawText: string, brandNames: string[]): MaskResult {
  const valueById = new Map<string, string>();
  let counter = 0;
  function mask(kind: string, realValue: string): string {
    const id = `${kind}${counter++}`;
    valueById.set(id, realValue.toLowerCase());
    return ` ${id} `;
  }

  let text = canonicalizeDates(rawText);
  text = text.replace(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\s+(\d{4})\b/gi,
    (m) => mask("datetoken", m),
  );
  text = text.replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, (m) => mask("figuretoken", m));
  text = text.replace(/\b\d+(?:\.\d+)?\s?%/g, (m) => mask("figuretoken", m));
  text = text.replace(/\b\d+(?:\.\d+)?\s*(?:to|-)\s*\d+(?:\.\d+)?\s*percent\b/gi, (m) => mask("figuretoken", m));
  text = text.replace(/\b\d+(?:\.\d+)?\s*percent\b/gi, (m) => mask("figuretoken", m));
  text = text.replace(/https?:\/\/\S+/g, (m) => mask("urltoken", m));
  for (const brand of brandNames) {
    if (!brand) continue;
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), (m) => mask("brandtoken", m));
  }
  text = text.replace(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\b/g, (m) => mask("entitytoken", m));

  return { masked: text, valueById };
}

// Strips the unique suffix ("figuretoken3" -> "figuretoken") so
// different real values of the same kind are treated as the same
// generic slot for counting repeated windows.
function genericForm(token: string): string {
  return /^(datetoken|figuretoken|urltoken|brandtoken|entitytoken)\d+$/.test(token)
    ? token.replace(/\d+$/, "")
    : token;
}

// A window that's mostly fact-anchors/citation-marker words is
// structurally an attribution tag, not narrative content.
function isCitationShaped(genericWords: string[]): boolean {
  const anchorCount = genericWords.filter(
    (w) =>
      w === "datetoken" || w === "figuretoken" || w === "urltoken" ||
      w === "brandtoken" || w === "entitytoken" || CITATION_MARKERS.has(w),
  ).length;
  return anchorCount / genericWords.length >= CITATION_SHAPE_THRESHOLD;
}

function contentWordSet(words: string[]): Set<string> {
  return new Set(words.filter((w) => !STOPWORDS.has(w) && w.length > 0));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

// Word-set (order-independent, stopword-filtered) Jaccard overlap
// between the flagged window and every same-size sliding window of the
// reference text -- catches word-order reversals and verb-form
// paraphrase that no contiguous-substring check can bridge, while
// staying LOCAL (same-size window comparison, not "does this word
// appear anywhere in a huge blob") so it isn't just a permissive
// bag-of-words check. Verified against a real adversarial case:
// invented filler sharing topical vocabulary with real reference
// material did NOT get falsely exempted at this threshold.
function isGroundedByOverlap(
  windowWords: string[],
  referenceWords: string[],
  threshold: number = OVERLAP_GROUNDING_THRESHOLD,
): boolean {
  const windowSet = contentWordSet(windowWords);
  if (windowSet.size === 0) return false;
  const size = windowWords.length;
  for (let i = 0; i + size <= referenceWords.length; i++) {
    const refSet = contentWordSet(referenceWords.slice(i, i + size));
    if (jaccard(windowSet, refSet) >= threshold) return true;
  }
  return false;
}

// quick_answer/key_takeaways/body/faq are four distinct real
// structural purposes (writer rules 8-11). Reuses parseArticleBody's
// own real section-splitting (already built for rendering/TOC) rather
// than re-deriving heading boundaries. All body H2/H3 sections are
// deliberately treated as ONE collective zone, not one per section --
// round 6 tried per-section zones and found it introduced a real
// regression (see the comment above) without fixing its target.
function getZoneTexts(body: string): Record<string, string> {
  const parsed = parseArticleBody(body);
  return {
    quick_answer: parsed.quickAnswer ?? "",
    key_takeaways: parsed.keyTakeaways ?? "",
    body: parsed.sections.map((s) => s.content).join(" "),
    faq: parsed.faq ?? "",
  };
}

function countGenericPhraseInText(genericPhrase: string, text: string, brandNames: string[]): number {
  const { masked } = maskGroundedComponents(text, brandNames);
  const words = normalizeForRepetitionCheck(masked).split(" ").filter(Boolean);
  let count = 0;
  for (let i = 0; i + PHRASE_WINDOW_SIZE <= words.length; i++) {
    const key = words.slice(i, i + PHRASE_WINDOW_SIZE).map(genericForm).join(" ");
    if (key === genericPhrase) count++;
  }
  return count;
}

// Exempt only if the window touches >=2 distinct real structural
// zones AND no single zone repeats it more than once internally --
// that's exactly rule 9's "introduce once, explain in full later"
// pattern. A window repeating 2+ times WITHIN one zone (e.g. the same
// sentence copy-pasted into two different body sections) is not
// covered by that justification and still needs to earn exemption via
// the checks below.
function isStructurallyExempt(genericPhrase: string, body: string, brandNames: string[]): boolean {
  const zones = getZoneTexts(body);
  const perZoneCounts = Object.values(zones).map((text) =>
    countGenericPhraseInText(genericPhrase, text, brandNames),
  );
  const zonesTouched = perZoneCounts.filter((c) => c > 0).length;
  const maxPerZone = Math.max(...perZoneCounts, 0);
  return zonesTouched >= 2 && maxPerZone <= 1;
}

function findRepeatedPhrase(
  body: string,
  referenceText: string,
  brandNames: string[],
): string | null {
  const { masked, valueById } = maskGroundedComponents(body, brandNames);
  const idWords = normalizeForRepetitionCheck(masked).split(" ").filter(Boolean);

  const genericCounts = new Map<string, { count: number; occurrences: string[][] }>();
  for (let i = 0; i + PHRASE_WINDOW_SIZE <= idWords.length; i++) {
    const windowIdWords = idWords.slice(i, i + PHRASE_WINDOW_SIZE);
    const genericKey = windowIdWords.map(genericForm).join(" ");
    const entry = genericCounts.get(genericKey) ?? { count: 0, occurrences: [] };
    entry.count++;
    entry.occurrences.push(windowIdWords);
    genericCounts.set(genericKey, entry);
  }

  const { masked: maskedReference } = maskGroundedComponents(referenceText, brandNames);
  const referenceWords = normalizeForRepetitionCheck(maskedReference)
    .split(" ")
    .filter(Boolean)
    .map(genericForm);

  for (const [genericPhrase, { count, occurrences }] of genericCounts) {
    if (count < PHRASE_REPETITION_THRESHOLD) continue;
    const genericWords = genericPhrase.split(" ");

    if (isStructurallyExempt(genericPhrase, body, brandNames)) continue;

    if (isCitationShaped(genericWords)) {
      const realValueTuples = occurrences.map((occ) =>
        occ.map((w) => valueById.get(w) ?? w).join("|"),
      );
      const allSame = realValueTuples.every((t) => t === realValueTuples[0]);
      if (allSame) continue;
    }

    if (isGroundedByOverlap(genericWords, referenceWords)) continue;

    return `the phrase "${genericPhrase}" appears ${count} times`;
  }
  return null;
}

function findDuplicateParagraph(body: string): string | null {
  const counts = new Map<string, number>();

  for (const rawParagraph of body.split(/\n\s*\n/)) {
    const normalized = normalizeForRepetitionCheck(rawParagraph);
    if (normalized.split(" ").filter(Boolean).length < MIN_PARAGRAPH_WORDS) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  for (const [paragraph, count] of counts) {
    if (count >= PARAGRAPH_REPETITION_THRESHOLD) {
      const preview = paragraph.length > 100 ? `${paragraph.slice(0, 100)}...` : paragraph;
      return `a paragraph appears ${count} times: "${preview}"`;
    }
  }
  return null;
}

function findBannedWordUsage(body: string, bannedWords: string[]): string | null {
  const lowerBody = body.toLowerCase();
  for (const word of bannedWords) {
    if (!word) continue;
    const escaped = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(escaped).test(lowerBody)) {
      return `banned word/phrase used: "${word}"`;
    }
  }
  return null;
}

// findRepeatedPhrase() is deliberately NOT called here yet -- see its
// own comment above for the full six-round real-data history. Best
// validated state (round 5's design): 20.0% false-fail rate (11/55 real
// recent drafts) -- real improvement over doing nothing, but still not
// low enough to hard-fail on without risking real, legitimate content.
// Needs referenceText and the article's real brand names to run, which
// runLintChecks/LintContext don't carry today -- wiring it in means
// threading those through, not just calling it here.
export function findRepetitionIssues(
  body: string,
  bannedWords: string[],
): string | null {
  return (
    findBannedWordUsage(body, bannedWords) ??
    findDuplicateParagraph(body)
  );
}

// Server-side floor, same reasoning as the checks above: cross-article
// duplication (Fix 6 item #7) must be caught deterministically, not
// left to a model judging it against N full candidate bodies dropped
// into the grader prompt -- that would add 15-40k+ tokens to an
// already-large prompt on a pipeline with a known, unresolved Vercel
// timeout problem, and an exact phrase/structure match is exactly what
// this computation is for. Same algorithm as the existing
// lib/scoring/duplicates.ts (8-word shingles, Jaccard similarity),
// reused rather than reinvented -- that module's version has no
// site/status scoping and belongs to the older, separate manual
// /editor page, not this pipeline. 0.6 validated for real against the
// actual published catalog (2026-09-10): a clean gap with zero real
// pairs sits at [0.5, 0.6) -- everything below is genuinely distinct
// content, everything at or above (confirmed by reading real bodies)
// is near-identical filler, including two real pairs scoring a
// literal 1.000.
const SIMILARITY_SHINGLE_SIZE = 8;
export const CROSS_ARTICLE_SIMILARITY_THRESHOLD = 0.6;

function normalizeForSimilarity(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSimilarityShingles(
  text: string,
  size = SIMILARITY_SHINGLE_SIZE,
): Set<string> {
  const words = normalizeForSimilarity(text).split(" ");
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - size; i++) {
    shingles.add(words.slice(i, i + size).join(" "));
  }
  return shingles;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function findCrossArticleDuplicate(
  draftBody: string,
  candidates: { id: string; title: string; body_markdown: string }[],
  threshold: number = CROSS_ARTICLE_SIMILARITY_THRESHOLD,
): string | null {
  const draftShingles = getSimilarityShingles(draftBody);
  for (const candidate of candidates) {
    const sim = jaccardSimilarity(
      draftShingles,
      getSimilarityShingles(candidate.body_markdown),
    );
    if (sim >= threshold) {
      const percent = Math.round(sim * 100);
      return `too similar (${percent}% shingle overlap) to already-published "${candidate.title}" (${candidate.id})`;
    }
  }
  return null;
}

// Fix 6 item #5 backstop (manager feedback section 3) -- narrow, scoped
// hard-fail for the one real risk actual data supported: a
// comparison/single_brand article naming real brands with ZERO real
// sources AND zero real figures anywhere. Deliberately not a universal
// minimum -- real data (20 recent real passing articles, 2026-09-10)
// showed 4 of 20 real, good articles have zero figures and 1 of 20 has
// zero sources, all legitimately (buying_guide/explainer process
// guides with no factual claim that needs a number -- one read in full
// and confirmed genuinely good at 91/100, correctly grounded in real
// domain_facts that drafts.sources[] doesn't even count). A blanket
// minimum would have hard-failed those. Scoped to comparison/
// single_brand only, matching the manager's original complaint shape
// (a comparison article naming zero lenders). Reuses hasAnyFigure()
// rather than a new figure regex, so this can't drift from
// findMissingPromisedFigures's definition of "a real figure".
export function findZeroGroundingOnComparison(
  sources: string[],
  body: string,
  contentShape: ContentShape,
): string | null {
  if (contentShape !== "comparison" && contentShape !== "single_brand") {
    return null;
  }
  if (sources.length > 0 || hasAnyFigure(body)) {
    return null;
  }
  return `content shape is ${contentShape} but the draft has zero real sources and zero real figures ($ or %) anywhere`;
}

// Informational-only meta length check for the lint stage. Uses the exact
// same real thresholds as render-time truncation (TITLE_MAX_CHARS /
// DESCRIPTION_MAX_CHARS, imported from lib/blogMetadata.ts, not
// re-declared) so this can never drift from the real render-time limit.
// Render-time truncation (truncateForMeta -- word-boundary cut, never
// mid-word) already handles an overlength value gracefully today, so this
// is deliberately NOT a hard-fail. It exists only so a reviewer sees it in
// needs_review instead of discovering it silently after publish. Returns
// real Issue objects in the same shape the grader itself produces, so they
// render in the existing review-queue issues list (DraftVersionCard.tsx)
// with no new UI needed -- criterion "meta_length" formats cleanly via
// that component's existing formatCriterionName().
export function findMetaLengthIssues(
  title: string,
  metaDescription: string,
): Issue[] {
  const issues: Issue[] = [];

  if (title.length > TITLE_MAX_CHARS) {
    issues.push({
      criterion: "meta_length",
      severity: "low",
      quote: title,
      problem: `Title is ${title.length} characters, over the ${TITLE_MAX_CHARS}-character SEO limit -- it will be truncated at render (word-boundary cut, never mid-word).`,
      suggested_fix: `Informational only, does not block publishing -- render-time truncation already handles this. Shorten to ${TITLE_MAX_CHARS} characters or fewer if you want the full title to show in search results and social previews.`,
    });
  }

  if (metaDescription.length > DESCRIPTION_MAX_CHARS) {
    issues.push({
      criterion: "meta_length",
      severity: "low",
      quote: metaDescription,
      problem: `Meta description is ${metaDescription.length} characters, over the ${DESCRIPTION_MAX_CHARS}-character SEO limit -- it will be truncated at render (word-boundary cut, never mid-word).`,
      suggested_fix: `Informational only, does not block publishing -- render-time truncation already handles this. Shorten to ${DESCRIPTION_MAX_CHARS} characters or fewer if you want the full description to show in search results.`,
    });
  }

  return issues;
}

// ------------------------------------------------------------
// Fix 8 build order item 3 -- lint stage.
// Pure refactor: the 7 checks below (placeholder leftovers through
// zero-grounding) already existed as separate function calls stapled
// into the same synchronous block as grading. This wraps them in one
// named function, run as its own explicit step, so "lint" is a real,
// separately-named stage in the code, matching the manager's shape --
// no new check, no behavior change, no new AI call. Order and message
// text are preserved exactly so hardFailReason precedence is identical
// to before the refactor.
// ------------------------------------------------------------
export interface LintDraftFields {
  body_markdown: string;
  meta_description: string;
  hero_image_alt: string;
  sources: string[];
}

export interface LintContext {
  title: string;
  targetKeyword: string;
  validInternalLinkSlugs: string[];
  bannedWords: string[];
  similarityCandidates: { id: string; title: string; body_markdown: string }[];
  contentShape: ContentShape;
}

export interface LintResult {
  hardFailReason: string | null;
  // Informational-only findings -- never contribute to hardFailReason.
  // Merged into the stored grade's issues array by the caller so a
  // reviewer sees them; never fed into previousIssues/the reviser prompt.
  infoIssues: Issue[];
}

export function runLintChecks(
  draft: LintDraftFields,
  context: LintContext,
): LintResult {
  const placeholderLeftover = findPlaceholderLeftover({
    body_markdown: draft.body_markdown,
    meta_description: draft.meta_description,
    hero_image_alt: draft.hero_image_alt,
  });
  const missingPromisedFigures = findMissingPromisedFigures(
    context.title,
    context.targetKeyword,
    draft.body_markdown,
  );
  const invalidInternalLinks = findInvalidInternalLinks(
    draft.body_markdown,
    context.validInternalLinkSlugs,
  );
  const insufficientInternalLinks = findInsufficientInternalLinks(
    draft.body_markdown,
    context.validInternalLinkSlugs,
  );
  const fabricatedByline = findFabricatedByline(draft.body_markdown);
  const repetitionIssue = findRepetitionIssues(
    draft.body_markdown,
    context.bannedWords,
  );
  const crossArticleDuplicate = findCrossArticleDuplicate(
    draft.body_markdown,
    context.similarityCandidates,
  );
  const zeroGroundingIssue = findZeroGroundingOnComparison(
    draft.sources,
    draft.body_markdown,
    context.contentShape,
  );
  const metaLengthIssues = findMetaLengthIssues(
    context.title,
    draft.meta_description,
  );

  const hardFailReason =
    (placeholderLeftover ? `auto-fail: ${placeholderLeftover}` : null) ??
    (missingPromisedFigures ? `auto-fail: ${missingPromisedFigures}` : null) ??
    (invalidInternalLinks ? `auto-fail: ${invalidInternalLinks}` : null) ??
    (insufficientInternalLinks ? `auto-fail: ${insufficientInternalLinks}` : null) ??
    (fabricatedByline ? `auto-fail: ${fabricatedByline}` : null) ??
    (repetitionIssue ? `auto-fail: ${repetitionIssue}` : null) ??
    (crossArticleDuplicate ? `auto-fail: ${crossArticleDuplicate}` : null) ??
    (zeroGroundingIssue ? `auto-fail: ${zeroGroundingIssue}` : null);
  // metaLengthIssues is deliberately excluded from the hardFailReason
  // chain above -- informational only, see findMetaLengthIssues.

  return { hardFailReason, infoIssues: metaLengthIssues };
}

// ------------------------------------------------------------
// Article id generation
// articles.id has no DB default. Existing rows are a flat sequence
// art_0001, art_0002, ... shared across all sites.
// ------------------------------------------------------------
export async function nextArticleId(
  supabaseAdmin: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("articles")
    .select("id")
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Could not read the last article id: ${error.message}`);
  }

  const lastId = data?.[0]?.id as string | undefined;
  const match = lastId?.match(/^art_(\d+)$/);
  const nextNumber = match ? parseInt(match[1], 10) + 1 : 1;
  return `art_${String(nextNumber).padStart(4, "0")}`;
}

export interface NewArticleInput {
  site_id: string;
  title: string;
  target_keyword: string;
  search_intent: string;
  slug: string;
  status: "drafted" | "needs_review";
}

// Retries on a duplicate id (rare race between two requests) and on a
// duplicate slug (two titles that slugify the same way).
export async function insertArticleWithRetry(
  supabaseAdmin: SupabaseClient,
  input: NewArticleInput,
  slugify: (title: string) => string,
  maxAttempts = 5,
): Promise<{ id: string }> {
  let slug = input.slug;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const id = await nextArticleId(supabaseAdmin);

    const { data, error } = await supabaseAdmin
      .from("articles")
      .insert({
        id,
        site_id: input.site_id,
        slug,
        title: input.title,
        target_keyword: input.target_keyword,
        search_intent: input.search_intent,
        status: input.status,
      })
      .select("id")
      .single();

    if (!error) {
      return data as { id: string };
    }

    const isDuplicate = error.code === "23505";
    if (!isDuplicate) {
      throw new Error(`Could not create article: ${error.message}`);
    }

    if (error.message.includes("slug")) {
      slug = `${input.slug}-${attempt + 2}`;
      continue;
    }
    // Otherwise assume it was the id (a concurrent request took it) — loop
    // and nextArticleId() will pick a fresh number.
  }

  throw new Error("Could not create article after several id/slug collisions");
}

// The article is created with the caller's working title (input.title)
// before the writer runs, since drafts.article_id needs a real id to
// point at. Once the writer generates its own real title (see
// WriterOutput.title), this updates the article to match — same
// slug-collision retry as insertArticleWithRetry, since a different
// title can slugify to something another real article already has.
export async function updateArticleTitleWithRetry(
  supabaseAdmin: SupabaseClient,
  articleId: string,
  title: string,
  slugify: (title: string) => string,
  maxAttempts = 5,
): Promise<{ slug: string } | { errorMessage: string }> {
  let slug = slugify(title);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { error } = await supabaseAdmin
      .from("articles")
      .update({ title, slug })
      .eq("id", articleId);

    if (!error) {
      return { slug };
    }

    const isDuplicate = error.code === "23505";
    if (!isDuplicate || !error.message.includes("slug")) {
      return { errorMessage: error.message };
    }
    slug = `${slugify(title)}-${attempt + 2}`;
  }

  return { errorMessage: "Could not update article title after several slug collisions" };
}

export async function insertArticleBrands(
  supabaseAdmin: SupabaseClient,
  articleId: string,
  brands: BrandRow[],
): Promise<string | null> {
  if (brands.length === 0) return null;

  const joinRows = brands.map((brand, index) => ({
    article_id: articleId,
    brand_id: brand.id,
    role: index === 0 ? "primary" : "compared",
    position: index + 1,
  }));

  const { error } = await supabaseAdmin.from("article_brands").insert(joinRows);
  return error ? error.message : null;
}

// Real bug found during the SEO/metadata gap audit: keywords.assigned_article_id
// existed but nothing ever wrote it -- every keyword row stayed permanently
// unassigned regardless of real usage, even though lib/sites.ts already reads
// it to filter the keyword picker UI. Matches CreationBoxForm's existing
// intent-autofill logic exactly: same site, case-insensitive keyword text.
// Only claims a row that's still unassigned -- a Retry reuses the same
// target_keyword on a brand new article id (see ReviewActions.tsx: "Retry
// creates a new article"), and the original claim should stay put rather
// than silently move to every retry. Never throws -- a failure here is a
// planning-aid miss, not a reason to fail real article creation, same
// reasoning as notifyN8n never blocking the response.
export async function assignKeywordToArticle(
  supabaseAdmin: SupabaseClient,
  siteId: string,
  targetKeyword: string,
  articleId: string,
): Promise<void> {
  const normalized = targetKeyword.trim().toLowerCase();
  if (!normalized) return;

  const { data, error: lookupError } = await supabaseAdmin
    .from("keywords")
    .select("id, keyword")
    .eq("site_id", siteId)
    .is("assigned_article_id", null);

  if (lookupError) {
    console.warn(
      `keyword lookup failed for article ${articleId}: ${lookupError.message}`,
    );
    return;
  }

  const match = (data ?? []).find(
    (row) => row.keyword.trim().toLowerCase() === normalized,
  );
  if (!match) return;

  const { error: updateError } = await supabaseAdmin
    .from("keywords")
    .update({ assigned_article_id: articleId })
    .eq("id", match.id);

  if (updateError) {
    console.warn(
      `could not mark keyword ${match.id} assigned to article ${articleId}: ${updateError.message}`,
    );
  }
}

export interface DraftInsert {
  article_id: string;
  version: number;
  body_markdown: string;
  meta_description: string | null;
  slug: string | null;
  hero_image_alt: string | null;
  sources: string[];
  internal_links: string[];
  word_count: number;
  prompt_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export async function insertDraft(
  supabaseAdmin: SupabaseClient,
  draft: DraftInsert,
): Promise<{ id: string } | { errorMessage: string }> {
  const { data, error } = await supabaseAdmin
    .from("drafts")
    // cost_cl stays null — we have token counts but no agreed CL conversion yet.
    .insert({ ...draft, cost_cl: null })
    .select("id")
    .single();

  if (error) return { errorMessage: error.message };
  return { id: data.id as string };
}

export interface GradeInsert {
  draft_id: string;
  scores: Record<string, number>;
  weighted_total: number;
  passed: boolean;
  hard_fail_reason: string | null;
  issues: Issue[];
  verdict_summary: string;
  rubric_id: string;
  prompt_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export async function insertGrade(
  supabaseAdmin: SupabaseClient,
  grade: GradeInsert,
): Promise<{ id: string } | { errorMessage: string; code?: string }> {
  const { data, error } = await supabaseAdmin
    .from("grades")
    .insert({ ...grade, cost_cl: null })
    .select("id")
    .single();

  if (error) return { errorMessage: error.message, code: error.code };
  return { id: data.id as string };
}

// ------------------------------------------------------------
// Phase 6 — n8n webhook notification
// ------------------------------------------------------------
// Fires a POST to N8N_WEBHOOK_URL with the loop run's outcome, so n8n can
// route on outcome and notify Telegram. Never throws — a notification
// failure must not break the pipeline response. Does nothing (silently)
// if N8N_WEBHOOK_URL isn't set, so this is safe to call unconditionally
// before that env var exists.
//
// Optional N8N_WEBHOOK_SECRET is sent as a header, mirroring the
// x-pipeline-secret pattern, so the webhook can reject requests that
// didn't come from this app. No secrets are ever put in the payload body.
export interface LoopRunNotification {
  loop_run_id: string;
  article_id: string;
  site_id: string;
  site_name: string;
  title: string;
  outcome: "passed" | "failed_after_retries" | "error";
  attempts_used: number;
  first_score: number | null;
  final_score: number | null;
  best_draft_id: string | null;
  error_detail: string | null;
}

const N8N_WEBHOOK_TIMEOUT_MS = 10_000;

export async function notifyN8n(
  notification: LoopRunNotification,
): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    N8N_WEBHOOK_TIMEOUT_MS,
  );

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (webhookSecret) {
      headers["x-webhook-secret"] = webhookSecret;
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(notification),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(
        `n8n webhook returned ${res.status} for loop_run ${notification.loop_run_id}`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn(
      `n8n webhook call failed for loop_run ${notification.loop_run_id}: ${message}`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
