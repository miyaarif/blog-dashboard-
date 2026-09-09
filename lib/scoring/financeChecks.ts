import type { Article } from "@/types";
import type { CheckResult } from "./baseChecks";

export function runFinanceChecks(article: Article): CheckResult[] {
  return [
    {
      passed: article.author_name.length > 0,
      message: "Finance content requires a named author",
    },
    {
      passed: article.author_credentials.length > 0,
      message: "Author credentials are required for finance content",
    },
    {
      passed: article.reviewed_by !== null && article.reviewed_by.length > 0,
      message: "Finance content requires an expert reviewer",
    },
    {
      passed: article.sources.length > 0,
      message: "Finance content must cite sources",
    },
    {
      passed: article.sources.length >= 2,
      message: "Finance content should cite at least 2 quality sources",
    },
    {
      passed: article.affiliate_disclosure === true,
      message: "Affiliate disclosure is required",
    },
    {
      // last_updated is only populated on older, pre-pipeline articles;
      // updated_at is always real and set by Postgres, so it's the
      // honest fallback rather than treating every last_updated-less
      // article as stale (new Date(null) would parse as 1970).
      passed: isRecentEnough(article.last_updated ?? article.updated_at),
      message: "Finance content must be updated within the last 12 months",
    },
  ];
}

function isRecentEnough(dateStr: string): boolean {
  const updated = new Date(dateStr);
  const now = new Date();
  const monthsAgo =
    (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return monthsAgo <= 12;
}
