import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { slugify, countWords } from "@/lib/newArticle";
import {
  SiteRow,
  BrandProfileRow,
  BrandRow,
  PromptRow,
  STALE_AFTER_DAYS,
  isNonEmptyString,
  isStringArray,
  formatBulletList,
  formatBrandFacts,
  fillTemplate,
  daysSince,
  callDeepSeek,
  WRITER_MAX_TOKENS,
  ChatMessage,
  DeepSeekResult,
  parseWriterOutput,
  insertArticleWithRetry,
  insertArticleBrands,
  insertDraft,
} from "@/lib/pipelineShared";

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

function validateBody(body: unknown): {
  errors: string[];
  value: GenerateRequestBody | null;
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

  const { errors, value: input } = validateBody(rawBody);
  if (!input) {
    return NextResponse.json(
      { error: "Invalid input", details: errors },
      { status: 400 },
    );
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
  const { data: specificPrompt, error: specificPromptError } =
    await supabaseAdmin
      .from("prompts")
      .select("id,body,model")
      .eq("role", "writer")
      .is("variant", null)
      .eq("content_profile", siteRow.content_profile)
      .eq("active", true)
      .maybeSingle();

  if (specificPromptError) {
    return NextResponse.json(
      { error: "Could not load writer prompt" },
      { status: 500 },
    );
  }

  let prompt = specificPrompt as PromptRow | null;

  if (!prompt) {
    const { data: genericPrompt, error: genericPromptError } =
      await supabaseAdmin
        .from("prompts")
        .select("id,body,model")
        .eq("role", "writer")
        .is("variant", null)
        .is("content_profile", null)
        .eq("active", true)
        .maybeSingle();

    if (genericPromptError) {
      return NextResponse.json(
        { error: "Could not load writer prompt" },
        { status: 500 },
      );
    }
    prompt = genericPrompt as PromptRow | null;
  }

  if (!prompt) {
    return NextResponse.json(
      {
        error: `no active writer prompt for content_profile '${siteRow.content_profile}'`,
      },
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

  // ---- call the writer model, one retry if the JSON doesn't parse ----
  const messages: ChatMessage[] = [{ role: "user", content: resolvedPrompt }];

  let attempt: DeepSeekResult;
  try {
    attempt = await callDeepSeek(
      deepseekApiKey,
      prompt.model,
      messages,
      WRITER_MAX_TOKENS,
      false,
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
  let rawText = attempt.content;
  let writerOutput = parseWriterOutput(rawText);

  if (!writerOutput) {
    messages.push({ role: "assistant", content: rawText });
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
        WRITER_MAX_TOKENS,
        false,
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
    rawText = retry.content;
    writerOutput = parseWriterOutput(rawText);
  }

  // ---- both attempts failed to parse: keep the raw text, flag for review ----
  if (!writerOutput) {
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
          status: "needs_review",
        },
        slugify,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create article";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const joinError = await insertArticleBrands(
      supabaseAdmin,
      article.id,
      brands,
    );
    if (joinError) {
      return NextResponse.json(
        { error: `Article created but could not link brands: ${joinError}` },
        { status: 500 },
      );
    }

    const draftResult = await insertDraft(supabaseAdmin, {
      article_id: article.id,
      version: 1,
      body_markdown: rawText,
      meta_description: null,
      slug: null,
      hero_image_alt: null,
      sources: [],
      internal_links: [],
      word_count: countWords(rawText),
      prompt_id: prompt.id,
      model: prompt.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    });

    if ("errorMessage" in draftResult) {
      return NextResponse.json(
        {
          error: `Article created but could not save draft: ${draftResult.errorMessage}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: "DeepSeek did not return valid JSON after one retry",
        article_id: article.id,
        draft_id: draftResult.id,
      },
      { status: 502 },
    );
  }

  // ---- success ----
  const finalSlug = isNonEmptyString(writerOutput.slug)
    ? slugify(writerOutput.slug)
    : slugify(input.title);

  let article: { id: string };
  try {
    article = await insertArticleWithRetry(
      supabaseAdmin,
      {
        site_id: siteRow.id,
        title: input.title,
        target_keyword: input.target_keyword,
        search_intent: input.search_intent,
        slug: finalSlug,
        status: "drafted",
      },
      slugify,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create article";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const joinError = await insertArticleBrands(
    supabaseAdmin,
    article.id,
    brands,
  );
  if (joinError) {
    return NextResponse.json(
      { error: `Article created but could not link brands: ${joinError}` },
      { status: 500 },
    );
  }

  const wordCount = countWords(writerOutput.body_markdown);

  const draftResult = await insertDraft(supabaseAdmin, {
    article_id: article.id,
    version: 1,
    body_markdown: writerOutput.body_markdown,
    meta_description: writerOutput.meta_description,
    slug: finalSlug,
    hero_image_alt: writerOutput.hero_image_alt,
    sources: writerOutput.sources,
    internal_links: writerOutput.internal_links,
    word_count: wordCount,
    prompt_id: prompt.id,
    model: prompt.model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });

  if ("errorMessage" in draftResult) {
    return NextResponse.json(
      {
        error: `Article created but could not save draft: ${draftResult.errorMessage}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    article_id: article.id,
    draft_id: draftResult.id,
    word_count: wordCount,
    tokens: { input_tokens: inputTokens, output_tokens: outputTokens },
  });
}
