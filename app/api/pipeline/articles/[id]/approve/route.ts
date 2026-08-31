import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Approve requires a reviewer-chosen date: the calendar page only shows
// articles with scheduled_for or published_at set, so setting status
// alone would make an "approved" article invisible there.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const candidate = (rawBody ?? {}) as Record<string, unknown>;
  if (!isValidDateString(candidate.scheduled_for)) {
    return NextResponse.json(
      { error: "scheduled_for is required, format YYYY-MM-DD" },
      { status: 400 },
    );
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

  const { data, error } = await supabaseAdmin
    .from("articles")
    .update({ status: "scheduled", scheduled_for: candidate.scheduled_for })
    .eq("id", id)
    .select("id,status,scheduled_for")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `Could not approve article: ${error.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Unknown article id" }, { status: 404 });
  }

  return NextResponse.json(data);
}
