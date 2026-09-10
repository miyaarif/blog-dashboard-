// ------------------------------------------------------------
// scheduled -> published. The one and only place this transition
// happens, so the cron route and the manual "Publish now" button can't
// drift apart — both call publishArticle().
//
// Deliberately doesn't touch body_markdown/meta_description/slug/etc —
// those are already copied onto the articles row at approve time (see
// app/api/pipeline/articles/[id]/approve/route.ts). This only flips
// status and stamps published_at.
// ------------------------------------------------------------
import { SupabaseClient } from "@supabase/supabase-js";

export interface PublishedArticle {
  id: string;
  status: "published";
  published_at: string;
}

export async function publishArticle(
  supabaseAdmin: SupabaseClient,
  articleId: string,
): Promise<PublishedArticle | { errorMessage: string }> {
  const publishedAt = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("articles")
    // updated_at set explicitly here too, alongside the real
    // articles_set_updated_at DB trigger (confirmed firing correctly) --
    // defense-in-depth so this still updates correctly even if that
    // trigger is ever dropped or missed by a future migration.
    .update({ status: "published", published_at: publishedAt, updated_at: publishedAt })
    .eq("id", articleId)
    .select("id,status,published_at")
    .maybeSingle();

  if (error) return { errorMessage: error.message };
  if (!data) return { errorMessage: `Unknown article id: ${articleId}` };
  return data as PublishedArticle;
}

// scheduled_for is a plain YYYY-MM-DD date (no time component -- see
// approve/route.ts's isValidDateString), so "due" is a date comparison
// against today, not a timestamp comparison.
export async function findDueScheduledArticleIds(
  supabaseAdmin: SupabaseClient,
): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("articles")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", today);

  if (error) {
    throw new Error(`Could not query due scheduled articles: ${error.message}`);
  }
  return (data ?? []).map((a) => a.id as string);
}
