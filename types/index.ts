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
    | "published"
    | "rejected";
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

// ------------------------------------------------------------
// Pipeline types — read-only shapes for the review queue.
// Columns match supabase/migrations/20260825_phase1_pipeline.sql.
// These tables are service_role-only (RLS, no policies), so they're
// only ever fetched via app/api/ routes, never the anon client.
// ------------------------------------------------------------
export interface Draft {
  id: string;
  article_id: string;
  version: number;
  body_markdown: string;
  meta_description: string | null;
  slug: string | null;
  hero_image_alt: string | null;
  sources: string[];
  internal_links: string[];
  word_count: number | null;
  prompt_id: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cl: number | null;
  created_at: string;
}

export interface GradeIssue {
  criterion: string;
  severity: string;
  quote: string;
  problem: string;
  suggested_fix: string;
}

export interface Grade {
  id: string;
  draft_id: string;
  scores: Record<string, number>;
  weighted_total: number;
  passed: boolean;
  hard_fail_reason: string | null;
  issues: GradeIssue[];
  verdict_summary: string | null;
  rubric_id: string | null;
  prompt_id: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cl: number | null;
  created_at: string;
}

export interface LoopRun {
  id: string;
  article_id: string;
  attempts_used: number;
  first_score: number | null;
  final_score: number | null;
  best_draft_id: string | null;
  outcome: string;
  error_detail: string | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_cost_cl: number | null;
  duration_ms: number | null;
  started_at: string;
  finished_at: string | null;
}
