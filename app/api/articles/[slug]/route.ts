import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const DETAIL_FIELDS =
  "slug,title,meta_description,body_markdown,target_keyword,word_count,hero_image_url,hero_image_alt,author_name,author_credentials,reviewed_by,reviewed_at,sources,affiliate_disclosure,published_at,last_updated";

function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const site = request.nextUrl.searchParams.get("site");

  if (!site) {
    return withCors(
      NextResponse.json({ error: "Article not found" }, { status: 404 }),
    );
  }

  const { data: articles, error } = await supabase
    .from("articles")
    .select(DETAIL_FIELDS)
    .eq("site_id", site)
    .eq("slug", slug)
    .eq("status", "published")
    .limit(1);

  if (error || !articles || articles.length === 0) {
    return withCors(
      NextResponse.json({ error: "Article not found" }, { status: 404 }),
    );
  }

  return withCors(NextResponse.json(articles[0]));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
