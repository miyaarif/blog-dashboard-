"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { getArticles, getSites } from "@/lib/sites";
import { loadStoredArticles } from "@/lib/storage";
import ArticleEditorForm from "@/components/ArticleEditorForm";
import type { Article } from "@/types";

export default function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const sites = getSites();
  const allArticles = getArticles();

  const [status, setStatus] = useState<
    { state: "loading" } | { state: "ready"; article: Article } | { state: "not-found" }
  >({ state: "loading" });

  useEffect(() => {
    const stored = loadStoredArticles()[id];
    const base = stored ?? allArticles.find((a) => a.id === id);
    setStatus(base ? { state: "ready", article: base } : { state: "not-found" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (status.state === "loading") return null;

  if (status.state === "not-found") {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-gray-600">Article not found.</p>
      </div>
    );
  }

  return (
    <ArticleEditorForm
      key={id}
      initialArticle={status.article}
      sites={sites}
      allArticles={allArticles}
      isNew={false}
      backHref="/articles"
      heading="Edit article"
    />
  );
}
