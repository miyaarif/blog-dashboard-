import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Matches the intent vocabulary already in use across the app
// (CreationBoxForm's INTENT_OPTIONS) rather than inventing a new list.
const INTENT_OPTIONS = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
] as const;

interface AddKeywordBody {
  site_id?: unknown;
  keyword?: unknown;
  monthly_volume?: unknown;
  difficulty?: unknown;
  intent?: unknown;
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = (rawBody ?? {}) as AddKeywordBody;

  const siteId = typeof body.site_id === "string" ? body.site_id.trim() : "";
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  const intent = typeof body.intent === "string" ? body.intent.trim() : "";
  const monthlyVolume = Number(body.monthly_volume);
  const difficulty = Number(body.difficulty);

  if (!siteId) {
    return NextResponse.json({ error: "site_id is required" }, { status: 400 });
  }
  if (!keyword) {
    return NextResponse.json({ error: "keyword is required" }, { status: 400 });
  }
  if (!INTENT_OPTIONS.includes(intent as (typeof INTENT_OPTIONS)[number])) {
    return NextResponse.json(
      { error: `intent must be one of: ${INTENT_OPTIONS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(monthlyVolume) || monthlyVolume < 0) {
    return NextResponse.json(
      { error: "monthly_volume must be a real, non-negative number — no placeholder figures" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(difficulty) || difficulty < 0 || difficulty > 100) {
    return NextResponse.json(
      { error: "difficulty must be a real number between 0 and 100 — no placeholder figures" },
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

  const { data: site, error: siteError } = await supabaseAdmin
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .maybeSingle();
  if (siteError) {
    return NextResponse.json(
      { error: `Could not verify site: ${siteError.message}` },
      { status: 500 },
    );
  }
  if (!site) {
    return NextResponse.json({ error: `Unknown site_id: ${siteId}` }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("keywords")
    .insert({
      site_id: siteId,
      keyword,
      monthly_volume: monthlyVolume,
      difficulty,
      intent,
      assigned_article_id: null,
      current_position: null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Could not create keyword: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
