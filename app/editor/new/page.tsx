import { getArticles, getSites } from "@/lib/sites";
import { createBlankArticle } from "@/lib/newArticle";
import NewArticleForm from "@/components/NewArticleForm";

export const dynamic = "force-dynamic";

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const [sites, allArticles] = await Promise.all([getSites(), getArticles()]);
  const { date } = await searchParams;
  const blank = createBlankArticle(sites[0].id, date ?? null);

  return (
    <NewArticleForm initialArticle={blank} sites={sites} allArticles={allArticles} />
  );
}
