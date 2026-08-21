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
      passed: isRecentEnough(article.last_updated),
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
