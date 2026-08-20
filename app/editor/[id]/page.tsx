"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { getArticles, getSites } from "@/lib/sites";
import { getArticleWithEdits, saveArticle } from "@/lib/storage";
import { scoreArticle } from "@/lib/scoring/score";
import { checkPublishGate } from "@/lib/scoring/publishGate";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CharCounter from "@/components/CharCounter";
import { EyeIcon } from "@/components/icons";
import type { Article } from "@/types";

export default function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const original = getArticles().find((a) => a.id === id);
  const sites = getSites();

  const [article, setArticle] = useState<Article | null>(null);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (original) {
      setArticle(getArticleWithEdits(original.id, original));
    }
  }, [original]);

  if (!original || !article) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-gray-600">Article not found.</p>
      </div>
    );
  }

  const currentSite = sites.find((s) => s.id === article.site_id)!;
  const { score, reasons } = scoreArticle(article, currentSite);

  const allArticles = getArticles();
  const gate = checkPublishGate(article, currentSite, allArticles);

  function update(field: keyof Article, value: string) {
    setArticle((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function handleSave() {
    if (!article) return;
    saveArticle(article);
    setSavedMessage("Saved");
    setTimeout(() => setSavedMessage(""), 2000);
  }

  const inputClass =
    "block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none";
  const labelClass = "block text-sm font-medium text-gray-700";

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <Link
          href={`/articles/${article.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <EyeIcon className="h-3.5 w-3.5" />
          View read page
        </Link>
        <div className="flex items-center gap-2">
          {savedMessage && (
            <span className="text-sm font-medium text-emerald-600">
              {savedMessage}
            </span>
          )}
          <button
            onClick={handleSave}
            className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <div>
            <label className={labelClass}>Site</label>
            <select
              value={article.site_id}
              onChange={(e) => update("site_id", e.target.value)}
              className={`${inputClass} mt-1`}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Title</label>
            <input
              value={article.title}
              onChange={(e) => update("title", e.target.value)}
              className={`${inputClass} mt-1`}
            />
            <div className="mt-1">
              <CharCounter value={article.title} min={50} max={60} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Meta description</label>
            <input
              value={article.meta_description}
              onChange={(e) => update("meta_description", e.target.value)}
              className={`${inputClass} mt-1`}
            />
            <div className="mt-1">
              <CharCounter
                value={article.meta_description}
                min={120}
                max={158}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Body (markdown)</label>
            <textarea
              value={article.body_markdown}
              onChange={(e) => update("body_markdown", e.target.value)}
              rows={18}
              className={`${inputClass} mt-1 font-mono`}
            />
          </div>

          <div className="rounded-md border border-gray-200 p-3">
            <p className="text-sm font-semibold text-gray-900">
              Score: {score} / 100
            </p>
            {reasons.length > 0 && (
              <ul className="mt-2 space-y-1">
                {reasons.map((r, i) => (
                  <li key={i} className="text-xs text-red-600">
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-md border border-gray-200 p-3">
            <p className="text-sm font-semibold text-gray-900">
              {gate.canPublish ? "Ready to publish" : "Blocked from publishing"}
            </p>
            {!gate.canPublish && (
              <ul className="mt-2 space-y-1">
                {gate.reasons.map((r, i) => (
                  <li key={i} className="text-xs text-red-600">
                    {r}
                  </li>
                ))}
              </ul>
            )}
            <button
              disabled={!gate.canPublish}
              className="mt-3 inline-flex items-center rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              Publish
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Preview
          </p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">
            {article.title}
          </h2>
          <div className="prose prose-sm mt-4 max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.body_markdown}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
