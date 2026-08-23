import { notFound } from "next/navigation";
import { getArticleById, getArticles, getSites } from "@/lib/sites";
import ArticleEditorForm from "@/components/ArticleEditorForm";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [article, sites, allArticles] = await Promise.all([
    getArticleById(id),
    getSites(),
    getArticles(),
  ]);

  if (!article) {
    notFound();
  }

  return (
    <ArticleEditorForm
      key={id}
      initialArticle={article}
      sites={sites}
      allArticles={allArticles}
      isNew={false}
      backHref="/articles"
      heading="Edit article"
    />
  );
}
