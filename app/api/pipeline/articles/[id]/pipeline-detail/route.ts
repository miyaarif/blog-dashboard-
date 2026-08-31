import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Draft, Grade, LoopRun } from "@/types";

export const dynamic = "force-dynamic";

interface BrandRef {
  id: string;
  name: string;
}

// Aggregates everything the review queue needs for one article: every
// draft version, each draft's grade, the most recent loop_run, and the
// brands it was written about. All four tables are service_role-only
// (RLS, no policies), so this route exists purely to let review-queue
// pages read them without importing supabaseAdmin themselves.
export async function GET(
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

  const { data: draftRows, error: draftsError } = await supabaseAdmin
    .from("drafts")
    .select("*")
    .eq("article_id", id)
    .order("version", { ascending: true });

  if (draftsError) {
    return NextResponse.json({ error: "Could not load drafts" }, { status: 500 });
  }
  const drafts = (draftRows ?? []) as Draft[];

  let grades: Grade[] = [];
  const draftIds = drafts.map((d) => d.id);
  if (draftIds.length > 0) {
    const { data: gradeRows, error: gradesError } = await supabaseAdmin
      .from("grades")
      .select("*")
      .in("draft_id", draftIds);

    if (gradesError) {
      return NextResponse.json({ error: "Could not load grades" }, { status: 500 });
    }
    grades = (gradeRows ?? []) as Grade[];
  }

  const { data: loopRunRows, error: loopRunError } = await supabaseAdmin
    .from("loop_runs")
    .select("*")
    .eq("article_id", id)
    .order("started_at", { ascending: false })
    .limit(1);

  if (loopRunError) {
    return NextResponse.json({ error: "Could not load loop run" }, { status: 500 });
  }
  const loopRun = ((loopRunRows ?? [])[0] as LoopRun | undefined) ?? null;

  const { data: joinRows, error: joinError } = await supabaseAdmin
    .from("article_brands")
    .select("brand_id")
    .eq("article_id", id)
    .order("position", { ascending: true });

  if (joinError) {
    return NextResponse.json({ error: "Could not load article_brands" }, { status: 500 });
  }

  const brandIds = (joinRows ?? []).map((row) => row.brand_id as string);
  let brands: BrandRef[] = [];
  if (brandIds.length > 0) {
    const { data: brandRows, error: brandsError } = await supabaseAdmin
      .from("brands")
      .select("id,name")
      .in("id", brandIds);

    if (brandsError) {
      return NextResponse.json({ error: "Could not load brands" }, { status: 500 });
    }
    brands = (brandRows ?? []) as BrandRef[];
  }

  return NextResponse.json({ drafts, grades, loop_run: loopRun, brands });
}
