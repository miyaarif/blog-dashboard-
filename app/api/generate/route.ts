import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slugify } from "@/lib/newArticle";

// ------------------------------------------------------------
// Input shape
// ------------------------------------------------------------
interface GenerateRequestBody {
  site_id: string;
  title: string;
  target_keyword: string;
  keywords: string[];
  brand_names: string[];
  search_intent: string;
}

// ------------------------------------------------------------
// Row shapes — only the columns this route reads
// ------------------------------------------------------------
interface SiteRow {
  id: string;
  name: string;
  domain: string;
  vertical: string | null;
  audience: string | null;
  monetisation: string | null;
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
  last_verified_at: string | null;
  active: boolean;
}

interface PromptRow {
  id: string;
  body: string;
}

const STALE_AFTER_DAYS = 90;

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateBody(body: unknown): { errors: string[]; value: GenerateRequestBody | null } {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null) {
    return { errors: ["Request body must be a JSON object"], value: null };
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.site_id)) errors.push("site_id is required");
  if (!isNonEmptyString(candidate.title)) errors.push("title is required");
  if (!isNonEmptyString(candidate.target_keyword)) errors.push("target_keyword is required");
  if (!isNonEmptyString(candidate.search_intent)) errors.push("search_intent is required");
  if (!isStringArray(candidate.keywords)) errors.push("keywords must be an array of strings");
  if (!isStringArray(candidate.brand_names)) errors.push("brand_names must be an array of strings (can be empty)");

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
// Formatting helpers for the prompt template
// ------------------------------------------------------------
function formatBulletList(items: string[] | null): string {
  if (!items || items.length === 0) return "- (none recorded)";
  return items.map((item) => `- ${item}`).join("\n");
}

function formatBrandFacts(brands: BrandRow[]): string {
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

function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key: string) => {
    return key in values ? values[key] : match;
  });
}

function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

// ------------------------------------------------------------
// Article id generation
// articles.id has no DB default. Existing rows are a flat sequence
// art_0001, art_0002, ... shared across all sites.
// ------------------------------------------------------------
async function nextArticleId(): Promise<string> {
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

interface NewArticleInput {
  site_id: string;
  title: string;
  target_keyword: string;
  search_intent: string;
  slug: string;
}

// Retries on a duplicate id (rare race between two requests) and on a
// duplicate slug (two titles that slugify the same way).
async function insertArticleWithRetry(
  input: NewArticleInput,
  maxAttempts = 5,
): Promise<{ id: string }> {
  let slug = input.slug;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const id = await nextArticleId();

    const { data, error } = await supabaseAdmin
      .from("articles")
      .insert({
        id,
        site_id: input.site_id,
        slug,
        title: input.title,
        target_keyword: input.target_keyword,
        search_intent: input.search_intent,
        status: "drafted",
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { errors, value: input } = validateBody(rawBody);
  if (!input) {
    return NextResponse.json({ error: "Invalid input", details: errors }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Could not load brand profile" }, { status: 500 });
  }
  if (!brandProfile) {
    return NextResponse.json(
      { error: "no brand profile seeded for this site" },
      { status: 400 },
    );
  }
  const profile = brandProfile as BrandProfileRow;

  // ---- brands (partner facts) ----
  const requestedNames = Array.from(new Set(input.brand_names));
  let brands: BrandRow[] = [];
  const warnings: string[] = [];

  if (requestedNames.length > 0) {
    const { data: brandRows, error: brandsError } = await supabaseAdmin
      .from("brands")
      .select(
        "id,name,what_they_are,strengths,weaknesses,eligibility,product_range,rate_note,last_verified_at,active",
      )
      .in("name", requestedNames);

    if (brandsError) {
      return NextResponse.json({ error: "Could not load brands" }, { status: 500 });
    }

    const found = (brandRows ?? []) as BrandRow[];
    const foundByName = new Map(found.map((b) => [b.name, b]));

    const missingNames = requestedNames.filter((name) => !foundByName.has(name));
    const inactiveNames = found.filter((b) => !b.active).map((b) => b.name);

    if (missingNames.length > 0 || inactiveNames.length > 0) {
      return NextResponse.json(
        {
          error: "refusing job — one or more brands are not a verified, active record",
          missing_brands: missingNames,
          inactive_brands: inactiveNames,
        },
        { status: 400 },
      );
    }

    brands = requestedNames.map((name) => foundByName.get(name) as BrandRow);

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
  }

  // ---- active writer prompt, site-specific first, generic fallback ----
  const { data: specificPrompt, error: specificPromptError } = await supabaseAdmin
    .from("prompts")
    .select("id,body")
    .eq("role", "writer")
    .is("variant", null)
    .eq("content_profile", siteRow.content_profile)
    .eq("active", true)
    .maybeSingle();

  if (specificPromptError) {
    return NextResponse.json({ error: "Could not load writer prompt" }, { status: 500 });
  }

  let prompt = specificPrompt as PromptRow | null;

  if (!prompt) {
    const { data: genericPrompt, error: genericPromptError } = await supabaseAdmin
      .from("prompts")
      .select("id,body")
      .eq("role", "writer")
      .is("variant", null)
      .is("content_profile", null)
      .eq("active", true)
      .maybeSingle();

    if (genericPromptError) {
      return NextResponse.json({ error: "Could not load writer prompt" }, { status: 500 });
    }
    prompt = genericPrompt as PromptRow | null;
  }

  if (!prompt) {
    return NextResponse.json(
      { error: `no active writer prompt for content_profile '${siteRow.content_profile}'` },
      { status: 400 },
    );
  }

  const resolvedPrompt = fillTemplate(prompt.body, {
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

  // ---- create the article row ----
  let article: { id: string };
  try {
    article = await insertArticleWithRetry({
      site_id: siteRow.id,
      title: input.title,
      target_keyword: input.target_keyword,
      search_intent: input.search_intent,
      slug: slugify(input.title),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create article";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // ---- join rows for the brands this article covers ----
  if (brands.length > 0) {
    const joinRows = brands.map((brand, index) => ({
      article_id: article.id,
      brand_id: brand.id,
      role: index === 0 ? "primary" : "compared",
      position: index + 1,
    }));

    const { error: joinError } = await supabaseAdmin.from("article_brands").insert(joinRows);
    if (joinError) {
      return NextResponse.json(
        { error: `Article created but could not link brands: ${joinError.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    article_id: article.id,
    resolved_prompt: resolvedPrompt,
    brand_count: brands.length,
    warnings,
  });
}
