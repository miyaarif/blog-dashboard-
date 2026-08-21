export interface Site {
  id: string;
  domain: string;
  name: string;
  vertical: string;
  description: string;
  audience: string;
  content_profile: "standard" | "ymyl_finance";
  publishing_cadence_per_week: number;
  status: string;
  primary_colour: string;
  monetisation: string;
  logo_url: string;
}

export interface Article {
  id: string;
  site_id: string;
  slug: string;
  title: string;
  meta_description: string;
  target_keyword: string;
  search_intent: string;
  status:
    | "idea"
    | "outlined"
    | "drafted"
    | "needs_review"
    | "scheduled"
    | "published";
  body_markdown: string;
  word_count: number;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  author_name: string;
  author_credentials: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sources: string[];
  affiliate_disclosure: boolean | null;
  last_updated: string;
  internal_links: string[];
  scheduled_for: string | null;
  published_at: string | null;
  organic_sessions_30d: number;
  avg_position: number | null;
}

export interface Keyword {
  keyword: string;
  site_id: string;
  monthly_volume: number;
  difficulty: number;
  intent: string;
  assigned_article_id: string | null;
  current_position: number | null;
}

export function isFinanceSite(site: Site): boolean {
  return site.content_profile === "ymyl_finance";
}
