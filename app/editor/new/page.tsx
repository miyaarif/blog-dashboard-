"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getArticles, getSites } from "@/lib/sites";
import { createBlankArticle } from "@/lib/newArticle";
import ArticleEditorForm from "@/components/ArticleEditorForm";
import type { Article } from "@/types";

export default function NewArticlePage() {
  const router = useRouter();
  const sites = getSites();
  const allArticles = getArticles();

  const [blank] = useState<Article>(() => createBlankArticle(sites[0].id));

  return (
    <ArticleEditorForm
      initialArticle={blank}
      sites={sites}
      allArticles={allArticles}
      isNew
      backHref="/articles"
      heading="New article"
      onSaved={(saved) => router.replace(`/editor/${saved.id}`)}
    />
  );
}
