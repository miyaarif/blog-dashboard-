import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isNonEmptyString } from "@/lib/pipelineShared";
import { pickIconName } from "@/lib/imageTopics";
import {
  buildHeroImageElement,
  loadHeroImageFonts,
  loadIconDataUri,
  HERO_IMAGE_WIDTH,
  HERO_IMAGE_HEIGHT,
} from "@/lib/heroImage";

const HERO_IMAGE_BUCKET = "hero-images";

async function ensureBucketExists(
  supabaseAdmin: SupabaseClient,
): Promise<string | null> {
  const { data: buckets, error: listError } =
    await supabaseAdmin.storage.listBuckets();
  if (listError) return `Could not list storage buckets: ${listError.message}`;

  const exists = (buckets ?? []).some((b) => b.name === HERO_IMAGE_BUCKET);
  if (exists) return null;

  const { error: createError } = await supabaseAdmin.storage.createBucket(
    HERO_IMAGE_BUCKET,
    { public: true, fileSizeLimit: "2MB" },
  );
  if (createError) return `Could not create storage bucket: ${createError.message}`;

  return null;
}

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

  let supabaseAdmin: SupabaseClient;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured: Supabase admin client is not configured" },
      { status: 500 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const candidate = rawBody as Record<string, unknown>;
  if (!isNonEmptyString(candidate.article_id)) {
    return NextResponse.json(
      { error: "article_id is required" },
      { status: 400 },
    );
  }
  const articleId = candidate.article_id;

  const { data: article, error: articleError } = await supabaseAdmin
    .from("articles")
    .select("id, site_id, title, target_keyword, hero_image_alt")
    .eq("id", articleId)
    .maybeSingle();

  if (articleError) {
    return NextResponse.json(
      { error: `Could not load article: ${articleError.message}` },
      { status: 500 },
    );
  }
  if (!article) {
    return NextResponse.json({ error: "Unknown article_id" }, { status: 404 });
  }

  const { data: site, error: siteError } = await supabaseAdmin
    .from("sites")
    .select("id, name, content_profile, primary_colour")
    .eq("id", article.site_id)
    .maybeSingle();

  if (siteError) {
    return NextResponse.json(
      { error: `Could not load site: ${siteError.message}` },
      { status: 500 },
    );
  }
  if (!site) {
    return NextResponse.json(
      { error: `Article's site_id '${article.site_id}' has no matching site row` },
      { status: 500 },
    );
  }

  const bucketError = await ensureBucketExists(supabaseAdmin);
  if (bucketError) {
    return NextResponse.json({ error: bucketError }, { status: 500 });
  }

  const iconName = pickIconName(
    article.title,
    article.target_keyword ?? "",
    site.content_profile,
  );

  const accentColour = site.primary_colour ?? "#334155";

  let fonts: Awaited<ReturnType<typeof loadHeroImageFonts>>;
  let iconDataUri: string;
  try {
    [fonts, iconDataUri] = await Promise.all([
      loadHeroImageFonts(),
      loadIconDataUri(iconName, "#ffffff"),
    ]);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load fonts or icon";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let imagePng: ArrayBuffer;
  try {
    const image = new ImageResponse(
      buildHeroImageElement({
        title: article.title,
        iconDataUri,
        accentColour,
        siteName: site.name,
      }),
      {
        width: HERO_IMAGE_WIDTH,
        height: HERO_IMAGE_HEIGHT,
        fonts: [
          { name: "Inter", data: fonts.regular, weight: 400, style: "normal" },
          { name: "Inter", data: fonts.bold, weight: 700, style: "normal" },
        ],
      },
    );
    imagePng = await image.arrayBuffer();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const storagePath = `${article.site_id}/${article.id}.png`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(HERO_IMAGE_BUCKET)
    .upload(storagePath, imagePng, { contentType: "image/png", upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { error: `Could not upload image: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(HERO_IMAGE_BUCKET)
    .getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl;

  const { data: latestDraft } = await supabaseAdmin
    .from("drafts")
    .select("hero_image_alt")
    .eq("article_id", article.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const updatePayload: Record<string, string> = { hero_image_url: publicUrl };
  if (!article.hero_image_alt && latestDraft?.hero_image_alt) {
    updatePayload.hero_image_alt = latestDraft.hero_image_alt;
  }

  const { error: updateError } = await supabaseAdmin
    .from("articles")
    .update(updatePayload)
    .eq("id", article.id);

  if (updateError) {
    return NextResponse.json(
      {
        error: `Image uploaded but article could not be updated: ${updateError.message}`,
        hero_image_url: publicUrl,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    article_id: article.id,
    icon: iconName,
    hero_image_url: publicUrl,
  });
}
