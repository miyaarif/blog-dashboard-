import { SupabaseClient } from "@supabase/supabase-js";

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
export const GRADER_MAX_TOKENS = 20000;
export const WRITER_MAX_TOKENS = 4000;

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
const PLACEHOLDER_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "square-bracket placeholder", pattern: /\[[^[\]]{1,80}\](?!\()/ },
  { name: "template placeholder", pattern: /\{\{[^{}]{1,80}\}\}/ },
  { name: '"TODO"', pattern: /\bTODO\b/i },
  { name: '"TBD"', pattern: /\bTBD\b/i },
  { name: '"XXX"', pattern: /\bXXX\b/i },
  { name: '"INSERT"', pattern: /\bINSERT\b/i },
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

  const hasFigure = PROMISED_FIGURE_PATTERNS.some((pattern) => pattern.test(body));
  if (hasFigure) return null;

  return `title/keyword promises a figure (matched ${matchedSignal.label}) but the body contains no dollar amount or percentage`;
}

// Server-side floor, same reasoning as the two checks above: whether a
// linked slug is real must not depend on the writer model remembering
// not to invent one. Only checks for a FABRICATED link — a real slug
// used that wasn't in the candidate list actually given to this
// attempt. Does not fail an article for having zero internal links;
// that's a real gap but not an active defect the way a broken link is
// (see the hard-fail decision recorded in loop-run.ts), so it's left
// as a softer, grader-flagged issue instead.
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

function findRepeatedPhrase(body: string): string | null {
  const words = normalizeForRepetitionCheck(body).split(" ").filter(Boolean);
  const counts = new Map<string, number>();

  for (let i = 0; i + PHRASE_WINDOW_SIZE <= words.length; i++) {
    const window = words.slice(i, i + PHRASE_WINDOW_SIZE).join(" ");
    counts.set(window, (counts.get(window) ?? 0) + 1);
  }

  for (const [phrase, count] of counts) {
    if (count >= PHRASE_REPETITION_THRESHOLD) {
      return `the phrase "${phrase}" appears ${count} times`;
    }
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

// findRepeatedPhrase() is deliberately NOT called here yet -- real
// testing against production data (art_0105, art_0108, art_0110)
// showed it false-positives on legitimate repeated citations,
// terminology definitions, and the article's own topic phrase. Kept
// in this file, unused, for later refinement (e.g. excluding windows
// that overlap the title/target keyword or a cited source name) rather
// than deleted, since the mechanism itself works (confirmed against a
// synthetic unbanned-filler-phrase case) -- it just isn't safe to gate
// on yet.
export function findRepetitionIssues(
  body: string,
  bannedWords: string[],
): string | null {
  return (
    findBannedWordUsage(body, bannedWords) ??
    findDuplicateParagraph(body)
  );
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
