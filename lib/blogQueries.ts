// Public blog data access — anon key only (articles/sites have no RLS
// blocking anon reads, confirmed live). Brand-deal data goes through
// app/api/blog/data.ts instead, since that needs service_role.
import { supabase } from "@/lib/supabase";
import type { Article, Site } from "@/types";

export const BLOG_PAGE_SIZE = 10;
export const FEATURED_COUNT = 3;

export async function getBlogSite(siteId: string): Promise<Site | null> {
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw error;
  return (data as Site) ?? null;
}

export async function getPublishedCount(siteId: string): Promise<number> {
  const { count, error } = await supabase
    .from("articles")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("status", "published");
  if (error) throw error;
  return count ?? 0;
}

// Most recent published articles, for the featured carousel. Ordered by
// published_at — falls back to created_at only if published_at is ever
// null on a published row (shouldn't happen, but this is real defensive
// ordering, not a guess about which column is populated).
export async function getFeaturedArticles(
  siteId: string,
  limit = FEATURED_COUNT,
): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("site_id", siteId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Article[];
}

export async function getPublishedArticlesPage(
  siteId: string,
  page: number,
  pageSize = BLOG_PAGE_SIZE,
): Promise<{ articles: Article[]; totalCount: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("articles")
    .select("*", { count: "exact" })
    .eq("site_id", siteId)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  return { articles: (data ?? []) as Article[], totalCount: count ?? 0 };
}

// slug has no explicit unique constraint documented in the migrations
// (articles predates them), but insertArticleWithRetry in
// lib/pipelineShared.ts retries specifically on a slug collision error —
// meaning the DB does enforce uniqueness on it network-wide, not just per
// site. So a slug alone is enough to find the article; no site scoping
// needed here.
export async function getPublishedArticleBySlug(
  slug: string,
): Promise<Article | null> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return (data as Article) ?? null;
}
