import type { Article, Site } from "@/types";
import { scoreArticle } from "./score";
import {
  findDuplicateGroups,
  isDuplicate,
  type DuplicateGroup,
} from "./duplicates";

export interface GateResult {
  canPublish: boolean;
  reasons: string[];
  duplicateOf: string[];
}

const MIN_SCORE_TO_PUBLISH = 70;

export function checkPublishGate(
  article: Article,
  site: Site,
  allArticles: Article[],
): GateResult {
  const { score, reasons: scoreReasons } = scoreArticle(article, site);
  const groups: DuplicateGroup[] = findDuplicateGroups(allArticles);
  const duplicate = isDuplicate(article.id, groups);

  const reasons: string[] = [];
  let duplicateOf: string[] = [];

  if (score < MIN_SCORE_TO_PUBLISH) {
    reasons.push(
      `Quality score is ${score}, below the minimum of ${MIN_SCORE_TO_PUBLISH}`,
    );
  }
  reasons.push(...scoreReasons);

  if (duplicate) {
    const group = groups.find((g) => g.articleIds.includes(article.id))!;
    duplicateOf = group.articleIds.filter((id) => id !== article.id);
    reasons.push(`Matches duplicate group with: ${duplicateOf.join(", ")}`);
  }

  return { canPublish: reasons.length === 0, reasons, duplicateOf };
}
