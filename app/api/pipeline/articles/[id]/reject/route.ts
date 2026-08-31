import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

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

  const { data, error } = await supabaseAdmin
    .from("articles")
    .update({ status: "rejected" })
    .eq("id", id)
    .select("id,status")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `Could not reject article: ${error.message}` },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Unknown article id" }, { status: 404 });
  }

  return NextResponse.json(data);
}
