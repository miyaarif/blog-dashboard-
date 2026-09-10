// ------------------------------------------------------------
// Real internal linking. Computed once per article, before attempt 1 —
// same pattern as the research stage: the real candidate pool doesn't
// change meaningfully across 3 attempts a few minutes apart, so there's
// no reason to re-query for every retry.
//
// Only real, currently-published articles on the SAME site are ever
// offered as candidates. The writer is never allowed to invent a slug;
// findInvalidInternalLinks() in lib/pipelineShared.ts is the
// deterministic backstop that doesn't depend on it following that rule.
// ------------------------------------------------------------
import { SupabaseClient } from "@supabase/supabase-js";

export interface InternalLinkCandidate {
  title: string;
  slug: string;
  target_keyword: string;
  search_intent: string;
}

// 20, not more: the largest real site catalog today (site_scholar) is
// 21 published articles, so this covers effectively the whole real
// catalog now while still bounding prompt size as sites grow past it.
// Each candidate line runs roughly 25-40 tokens formatted (see
// formatInternalLinkCandidates) -- 20 of them is a few hundred tokens,
// small next to the research-findings block already in the same
// prompt (measured for real in testing, not assumed).
export const MAX_INTERNAL_LINK_CANDIDATES = 20;

export async function getInternalLinkCandidates(
  supabaseAdmin: SupabaseClient,
  siteId: string,
  excludeArticleId: string,
): Promise<InternalLinkCandidate[]> {
  const { data, error } = await supabaseAdmin
    .from("articles")
    .select("title,slug,target_keyword,search_intent")
    .eq("site_id", siteId)
    .eq("status", "published")
    .neq("id", excludeArticleId)
    .order("published_at", { ascending: false })
    .limit(MAX_INTERNAL_LINK_CANDIDATES);

  if (error) {
    throw new Error(`Could not load internal link candidates: ${error.message}`);
  }
  return (data ?? []) as InternalLinkCandidate[];
}

export function formatInternalLinkCandidates(
  candidates: InternalLinkCandidate[],
): string {
  if (candidates.length === 0) {
    return "No other published articles exist yet for this site. Do not include any internal links in this article — there is nothing real to link to.";
  }

  return candidates
    .map(
      (c, i) =>
        `${i + 1}. "${c.title}" — slug: ${c.slug} (keyword: ${c.target_keyword}, intent: ${c.search_intent})`,
    )
    .join("\n");
}
