import type { Article } from "@/types";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function countWords(markdown: string): number {
  const trimmed = markdown.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function createBlankArticle(siteId: string): Article {
  return {
    id: `art_new_${Date.now().toString(36)}`,
    site_id: siteId,
    slug: "",
    title: "",
    meta_description: "",
    target_keyword: "",
    search_intent: "",
    status: "idea",
    body_markdown: "",
    word_count: 0,
    hero_image_url: null,
    hero_image_alt: null,
    author_name: "",
    author_credentials: "",
    reviewed_by: null,
    reviewed_at: null,
    sources: [],
    affiliate_disclosure: null,
    last_updated: new Date().toISOString().split("T")[0],
    internal_links: [],
    scheduled_for: null,
    published_at: null,
    organic_sessions_30d: 0,
    avg_position: null,
  };
}
