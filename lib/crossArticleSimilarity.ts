// ------------------------------------------------------------
// Real published-article candidates for cross-article similarity
// checking (Fix 6 item #7). Same fetch pattern and reasoning as
// lib/internalLinking.ts: computed once per article, before attempt 1
// -- the site's real published catalog doesn't change meaningfully
// across 3 attempts a few minutes apart. Scoped to the SAME site only
// and published articles only, matching the internal-linking
// precedent and validated for real against the actual published
// catalog (see the 2026-09-10 threshold test: same-site scoping is
// what the manager's underlying concern -- duplicate content on one
// of our own domains -- is actually about; a different site's article
// scoring similar isn't the same risk).
// ------------------------------------------------------------
import { SupabaseClient } from "@supabase/supabase-js";

export interface SimilarityCandidate {
  id: string;
  title: string;
  body_markdown: string;
}

// Same cap and reasoning as MAX_INTERNAL_LINK_CANDIDATES: the largest
// real site catalog today (site_scholar, 21 published) is barely over
// this, so it covers effectively the whole real catalog now.
export const MAX_SIMILARITY_CANDIDATES = 20;

export async function getSimilarityCandidates(
  supabaseAdmin: SupabaseClient,
  siteId: string,
  excludeArticleId: string,
): Promise<SimilarityCandidate[]> {
  const { data, error } = await supabaseAdmin
    .from("articles")
    .select("id,title,body_markdown")
    .eq("site_id", siteId)
    .eq("status", "published")
    .neq("id", excludeArticleId)
    .order("published_at", { ascending: false })
    .limit(MAX_SIMILARITY_CANDIDATES);

  if (error) {
    throw new Error(`Could not load similarity candidates: ${error.message}`);
  }
  return (data ?? []) as SimilarityCandidate[];
}
