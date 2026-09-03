import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// New sites default to "standard" (HME's profile) rather than the
// finance-heavy "ymyl_finance" the other two sites use — an unknown new
// site shouldn't be assumed to need YMYL-level sourcing/disclosure rules.
// Confirmed with the owner rather than guessed, since real data has both
// values in use. No rubric changes needed either way.
const DEFAULT_CONTENT_PROFILE = "standard";
const DEFAULT_STATUS = "active";

const MONETISATION_OPTIONS = ["services", "affiliate", "lead_gen"] as const;

function isValidHexColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

// Matches the id pattern already in use (site_hme, site_scholar, site_fuel):
// "site_" plus a lowercase slug. Existing ids are short hand-picked
// abbreviations; a generated id instead slugifies the full name so it
// stays predictable rather than guessing an abbreviation.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// Matches the logo pattern already in use on all 3 existing rows: a
// DiceBear initials avatar seeded with the site name, spaces stripped.
function dicebearLogoUrl(name: string): string {
  const seed = name.replace(/\s+/g, "");
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

interface CreateSiteBody {
  name?: unknown;
  domain?: unknown;
  vertical?: unknown;
  description?: unknown;
  audience?: unknown;
  monetisation?: unknown;
  publishing_cadence_per_week?: unknown;
  primary_colour?: unknown;
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = (rawBody ?? {}) as CreateSiteBody;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const domain = typeof body.domain === "string" ? body.domain.trim() : "";
  const vertical = typeof body.vertical === "string" ? body.vertical.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const audience = typeof body.audience === "string" ? body.audience.trim() : "";
  const monetisation =
    typeof body.monetisation === "string" ? body.monetisation.trim() : "";
  const cadence = Number(body.publishing_cadence_per_week);
  const primaryColour = body.primary_colour;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }
  if (!MONETISATION_OPTIONS.includes(monetisation as (typeof MONETISATION_OPTIONS)[number])) {
    return NextResponse.json(
      { error: `monetisation must be one of: ${MONETISATION_OPTIONS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(cadence) || cadence <= 0) {
    return NextResponse.json(
      { error: "publishing_cadence_per_week must be a positive number" },
      { status: 400 },
    );
  }
  if (!isValidHexColour(primaryColour)) {
    return NextResponse.json(
      { error: "primary_colour must be a hex colour, e.g. #2563eb" },
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

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("sites")
    .select("id");
  if (existingError) {
    return NextResponse.json(
      { error: `Could not check existing sites: ${existingError.message}` },
      { status: 500 },
    );
  }
  const existingIds = new Set((existing ?? []).map((s) => s.id as string));

  const base = `site_${slugify(name)}`;
  let id = base;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${base}_${suffix}`;
    suffix++;
  }

  const { data, error } = await supabaseAdmin
    .from("sites")
    .insert({
      id,
      domain,
      name,
      vertical,
      description,
      audience,
      content_profile: DEFAULT_CONTENT_PROFILE,
      publishing_cadence_per_week: cadence,
      status: DEFAULT_STATUS,
      primary_colour: primaryColour,
      monetisation,
      logo_url: dicebearLogoUrl(name),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Could not create site: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
