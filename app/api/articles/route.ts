import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const LIST_FIELDS =
  "slug,title,meta_description,hero_image_url,hero_image_alt,author_name,reviewed_by,word_count,published_at,last_updated";

function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const site = searchParams.get("site");
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");

  if (!site) {
    return withCors(
      NextResponse.json({ error: "Unknown or missing site id" }, { status: 400 }),
    );
  }

  const { data: siteRow } = await supabase
    .from("sites")
    .select("id")
    .eq("id", site)
    .maybeSingle();

  if (!siteRow) {
    return withCors(
      NextResponse.json({ error: "Unknown or missing site id" }, { status: 400 }),
    );
  }

  let query = supabase
    .from("articles")
    .select(LIST_FIELDS)
    .eq("site_id", site)
    .eq("status", "published");

  const limit = limitParam ? Number(limitParam) : null;
  const offset = offsetParam ? Number(offsetParam) : 0;
  if (limit !== null && Number.isFinite(limit)) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data: articles, error } = await query;
  if (error) {
    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 }),
    );
  }

  return withCors(
    NextResponse.json({ site, count: articles.length, articles }),
  );
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}
