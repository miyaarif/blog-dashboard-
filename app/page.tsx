import { getArticles } from "@/lib/sites";
import { findDuplicateGroups } from "@/lib/scoring/duplicates";

export default function Home() {
  const articles = getArticles();
  const groups = findDuplicateGroups(articles);

  return (
    <pre>{JSON.stringify({ groupCount: groups.length, groups }, null, 2)}</pre>
  );
}
