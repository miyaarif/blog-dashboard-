import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { publishArticle } from "@/lib/publish";

export const dynamic = "force-dynamic";

// Manual override for a reviewer who doesn't want to wait for
// scheduled_for -- publishes immediately regardless of that date.
// Same publishArticle() the cron route uses, so the two paths can't
// diverge on what "published" actually means.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured: Supabase admin client is not configured" },
      { status: 500 },
    );
  }

  const { data: article, error: articleError } = await supabaseAdmin
    .from("articles")
    .select("id,status")
    .eq("id", id)
    .maybeSingle();

  if (articleError) {
    return NextResponse.json(
      { error: `Could not load article: ${articleError.message}` },
      { status: 500 },
    );
  }
  if (!article) {
    return NextResponse.json({ error: "Unknown article id" }, { status: 404 });
  }
  if (article.status !== "scheduled") {
    return NextResponse.json(
      {
        error: `Article is not scheduled -- current status is "${article.status}". Only a scheduled article can be published.`,
      },
      { status: 409 },
    );
  }

  const result = await publishArticle(supabaseAdmin, id);
  if ("errorMessage" in result) {
    return NextResponse.json(
      { error: `Could not publish article: ${result.errorMessage}` },
      { status: 500 },
    );
  }

  return NextResponse.json(result);
}
