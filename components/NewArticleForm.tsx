"use client";

import { useRouter } from "next/navigation";
import ArticleEditorForm from "@/components/ArticleEditorForm";
import type { Article, Site } from "@/types";

export default function NewArticleForm({
  initialArticle,
  sites,
  allArticles,
}: {
  initialArticle: Article;
  sites: Site[];
  allArticles: Article[];
}) {
  const router = useRouter();

  return (
    <ArticleEditorForm
      initialArticle={initialArticle}
      sites={sites}
      allArticles={allArticles}
      isNew
      backHref="/articles"
      heading="New article"
      onSaved={(saved) => router.replace(`/editor/${saved.id}`)}
    />
  );
}
