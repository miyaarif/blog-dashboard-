import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { findDueScheduledArticleIds, publishArticle } from "@/lib/publish";

export const dynamic = "force-dynamic";

// Vercel Cron sends Authorization: Bearer <CRON_SECRET> automatically once
// CRON_SECRET is set as an env var -- this route must verify it itself,
// Vercel doesn't reject unauthorized requests on its own. Without this,
// anyone who finds the URL could trigger publishing on demand.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET is not set" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured: Supabase admin client is not configured" },
      { status: 500 },
    );
  }

  let dueIds: string[];
  try {
    dueIds = await findDueScheduledArticleIds(supabaseAdmin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not query due articles";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const published: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of dueIds) {
    const result = await publishArticle(supabaseAdmin, id);
    if ("errorMessage" in result) {
      failed.push({ id, error: result.errorMessage });
    } else {
      published.push(id);
    }
  }

  return NextResponse.json({
    checked: dueIds.length,
    published,
    failed,
  });
}
