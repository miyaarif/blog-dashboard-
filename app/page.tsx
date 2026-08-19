import { getSites, getArticles } from "@/lib/sites";
import { scoreArticle } from "@/lib/scoring/score";

export default function Home() {
  const sites = getSites();
  const article = getArticles()[0];
  const site = sites.find((s) => s.id === article.site_id)!;

  const result = scoreArticle(article, site);

  return <pre>{JSON.stringify(result, null, 2)}</pre>;
}
