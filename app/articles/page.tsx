import { getSites, getArticles } from "@/lib/sites";
import ArticlesTable from "@/components/ArticlesTable";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const [sites, articles] = await Promise.all([getSites(), getArticles()]);

  return <ArticlesTable sites={sites} articles={articles} />;
}
