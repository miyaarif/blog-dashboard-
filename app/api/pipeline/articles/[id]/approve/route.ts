import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const DRAFT_FIELDS_TO_COPY =
  "body_markdown,meta_description,slug,hero_image_alt,sources,internal_links,word_count";

// Approve requires a reviewer-chosen date: the calendar page only shows
// articles with scheduled_for or published_at set, so setting status
// alone would make an "approved" article invisible there.
//
// For a pipeline-generated article (has a loop_runs row), this also
// copies the winning draft's content onto the articles row — until now
// approve only flipped status, so a pipeline article never actually got
// real body_markdown/meta_description/slug/hero_image_alt/sources/
// internal_links/word_count on the row the public site reads from.
//
// A seed article (no loop_runs row, e.g. art_0023/art_0030 — confirmed
// real cases sitting in needs_review with real body content already
// baked in, never run through the pipeline) skips all of this and keeps
// the original status-only behavior — there's no draft to copy from and
// nothing to warn about.
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
  const confirmHardFail = candidate.confirm_hard_fail === true;

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured: Supabase admin client is not configured" },
      { status: 500 },
    );
  }

  // ---- does this article have a pipeline run at all? ----
  const { data: loopRunRows, error: loopRunError } = await supabaseAdmin
    .from("loop_runs")
    .select("best_draft_id")
    .eq("article_id", id)
    .order("started_at", { ascending: false })
    .limit(1);

  if (loopRunError) {
    return NextResponse.json(
      { error: `Could not check loop_runs: ${loopRunError.message}` },
      { status: 500 },
    );
  }
  const loopRun = loopRunRows?.[0] ?? null;

  const updatePayload: Record<string, unknown> = {
    status: "scheduled",
    scheduled_for: candidate.scheduled_for,
  };

  if (loopRun) {
    // A real pipeline run exists for this article — it must have picked a
    // best draft. If it didn't, that's a real data problem with this
    // specific article, not something to silently paper over.
    if (!loopRun.best_draft_id) {
      return NextResponse.json(
        {
          error:
            "This article has a loop_runs row but no best_draft_id — cannot approve without a draft to copy real content from. This should never happen; check the loop_runs row for this article directly.",
        },
        { status: 422 },
      );
    }

    const { data: draft, error: draftError } = await supabaseAdmin
      .from("drafts")
      .select(DRAFT_FIELDS_TO_COPY)
      .eq("id", loopRun.best_draft_id)
      .maybeSingle();

    if (draftError) {
      return NextResponse.json(
        { error: `Could not load the best draft: ${draftError.message}` },
        { status: 500 },
      );
    }
    if (!draft) {
      return NextResponse.json(
        {
          error: `best_draft_id (${loopRun.best_draft_id}) does not point to any real draft row — cannot approve.`,
        },
        { status: 422 },
      );
    }

    // ---- did the best draft actually pass? `passed` is the authoritative
    // field (recomputed server-side in loop-run as weighted_total >=
    // threshold && !hard_fail_reason) -- checked against real data before
    // choosing this: every one of the 32 real grades in production has
    // passed=false exactly when hard_fail_reason is set, no exceptions,
    // but `passed` is the safer field to gate on since it would also
    // catch a plain below-threshold draft with no specific rule violation,
    // which hard_fail_reason alone would miss. ----
    const { data: grade, error: gradeError } = await supabaseAdmin
      .from("grades")
      .select("passed,hard_fail_reason")
      .eq("draft_id", loopRun.best_draft_id)
      .maybeSingle();

    if (gradeError) {
      return NextResponse.json(
        { error: `Could not load the best draft's grade: ${gradeError.message}` },
        { status: 500 },
      );
    }

    // No grade row for a real draft should never happen (insertGrade
    // always follows insertDraft in the same loop) -- treated the same
    // as a hard fail (requires override) rather than assumed safe, since
    // we can't actually confirm it passed.
    const didNotPass = !grade || !grade.passed;

    if (didNotPass && !confirmHardFail) {
      return NextResponse.json(
        {
          error:
            "The best draft for this article did not pass review. Approving it anyway requires confirm_hard_fail: true.",
          passed: grade?.passed ?? null,
          hard_fail_reason: grade?.hard_fail_reason ?? "No grade was found for this draft.",
        },
        { status: 409 },
      );
    }

    updatePayload.body_markdown = draft.body_markdown;
    updatePayload.meta_description = draft.meta_description;
    updatePayload.slug = draft.slug;
    updatePayload.hero_image_alt = draft.hero_image_alt;
    updatePayload.sources = draft.sources;
    updatePayload.internal_links = draft.internal_links;
    updatePayload.word_count = draft.word_count;
  }

  const { data, error } = await supabaseAdmin
    .from("articles")
    .update(updatePayload)
    .eq("id", id)
    .select("id,status,scheduled_for,slug,word_count")
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
