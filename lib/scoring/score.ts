import type { Article, Site } from "@/types";
import { isFinanceSite } from "@/types";
import { runBaseChecks } from "./baseChecks";
import { runFinanceChecks } from "./financeChecks";

export interface ScoreResult {
  score: number;
  reasons: string[];
}

export function scoreArticle(article: Article, site: Site): ScoreResult {
  const baseResults = runBaseChecks(article);
  const financeResults = isFinanceSite(site) ? runFinanceChecks(article) : [];
  const allResults = [...baseResults, ...financeResults];

  const passedCount = allResults.filter((r) => r.passed).length;
  const score = Math.round((passedCount / allResults.length) * 100);

  const reasons = allResults.filter((r) => !r.passed).map((r) => r.message);

  return { score, reasons };
}
