import type { Article } from "@/types";

const MIN_WORD_COUNT_TO_CHECK = 100;
const SHINGLE_SIZE = 8;
const SIMILARITY_THRESHOLD = 0.6;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getShingles(text: string, size = SHINGLE_SIZE): Set<string> {
  const words = normalize(text).split(" ");
  const shingles = new Set<string>();
  for (let i = 0; i <= words.length - size; i++) {
    shingles.add(words.slice(i, i + size).join(" "));
  }
  return shingles;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export interface DuplicateGroup {
  articleIds: string[];
  similarity: number;
}

export function findDuplicateGroups(
  articles: Article[],
  threshold = SIMILARITY_THRESHOLD,
): DuplicateGroup[] {
  const eligible = articles.filter(
    (a) => a.word_count >= MIN_WORD_COUNT_TO_CHECK,
  );
  const shingleSets = eligible.map((a) => getShingles(a.body_markdown));
  const groups: DuplicateGroup[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < eligible.length; i++) {
    if (assigned.has(eligible[i].id)) continue;
    const matches: string[] = [eligible[i].id];
    let maxSim = 0;

    for (let j = i + 1; j < eligible.length; j++) {
      if (assigned.has(eligible[j].id)) continue;
      const sim = jaccardSimilarity(shingleSets[i], shingleSets[j]);
      if (sim >= threshold) {
        matches.push(eligible[j].id);
        maxSim = Math.max(maxSim, sim);
      }
    }

    if (matches.length > 1) {
      matches.forEach((id) => assigned.add(id));
      groups.push({
        articleIds: matches,
        similarity: Math.round(maxSim * 100) / 100,
      });
    }
  }

  return groups;
}

export function isDuplicate(
  articleId: string,
  groups: DuplicateGroup[],
): boolean {
  return groups.some((g) => g.articleIds.includes(articleId));
}
