"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getArticles, getSiteById } from "@/lib/sites";
import { loadStoredArticles } from "@/lib/storage";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import { PencilIcon } from "@/components/icons";
import type { Article } from "@/types";

export default function ArticleReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [status, setStatus] = useState<
    { state: "loading" } | { state: "ready"; article: Article } | { state: "not-found" }
  >({ state: "loading" });

  useEffect(() => {
    const stored = loadStoredArticles()[id];
    const base = stored ?? getArticles().find((a) => a.id === id);
    setStatus(base ? { state: "ready", article: base } : { state: "not-found" });
  }, [id]);

  if (status.state === "loading") return null;

  if (status.state === "not-found") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/articles" className="text-sm text-gray-500 hover:text-gray-900">
          ← Back to articles
        </Link>
        <p className="mt-6 text-sm text-gray-600">Article not found.</p>
      </div>
    );
  }

  const article = status.article;
  const site = getSiteById(article.site_id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/articles"
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← Back to articles
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {site && <SiteBadge site={site} />}
            <StatusPill status={article.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">
            {article.title}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {article.meta_description}
          </p>
        </div>
        <Link
          href={`/editor/${article.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <PencilIcon className="h-3.5 w-3.5" />
          Edit
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-gray-400">Author</dt>
          <dd className="mt-0.5 font-medium text-gray-900">
            {article.author_name}
          </dd>
        </div>
        <div>
          <dt className="text-gray-400">Word count</dt>
          <dd className="mt-0.5 font-medium text-gray-900">
            {article.word_count}
          </dd>
        </div>
        <div>
          <dt className="text-gray-400">Sessions / 30d</dt>
          <dd className="mt-0.5 font-medium text-gray-900">
            {article.organic_sessions_30d}
          </dd>
        </div>
        <div>
          <dt className="text-gray-400">Last updated</dt>
          <dd className="mt-0.5 font-medium text-gray-900">
            {article.last_updated?.split("T")[0] ?? "—"}
          </dd>
        </div>
      </dl>

      <article className="prose prose-sm mt-6 max-w-none rounded-lg border border-gray-200 bg-white p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {article.body_markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
