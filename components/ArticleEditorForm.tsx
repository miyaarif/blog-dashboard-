"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isFinanceSite, type Article, type Site } from "@/types";
import { saveArticle } from "@/lib/storage";
import { scoreArticle } from "@/lib/scoring/score";
import { checkPublishGate } from "@/lib/scoring/publishGate";
import { slugify, countWords } from "@/lib/newArticle";
import CharCounter from "@/components/CharCounter";
import { EyeIcon, SpinnerIcon } from "@/components/icons";

const MIN_SAVE_SPINNER_MS = 300;

const INTENT_OPTIONS = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
];

const inputClass =
  "block w-full rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink focus:border-line focus:outline-none";
const labelClass = "block text-sm font-medium text-ink";

export default function ArticleEditorForm({
  initialArticle,
  sites,
  allArticles,
  isNew,
  backHref,
  heading,
  onSaved,
}: {
  initialArticle: Article;
  sites: Site[];
  allArticles: Article[];
  isNew: boolean;
  backHref: string;
  heading: string;
  onSaved?: (saved: Article) => void;
}) {
  const [article, setArticle] = useState<Article>(initialArticle);
  const [savedMessage, setSavedMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const currentSite = sites.find((s) => s.id === article.site_id)!;
  const financeSite = isFinanceSite(currentSite);
  const { score, reasons } = scoreArticle(article, currentSite);
  const gate = checkPublishGate(article, currentSite, allArticles);

  function update<K extends keyof Article>(field: K, value: Article[K]) {
    setArticle((prev) => ({ ...prev, [field]: value }));
  }

  function updateBody(value: string) {
    setArticle((prev) => ({
      ...prev,
      body_markdown: value,
      word_count: countWords(value),
    }));
  }

  function updateSources(raw: string) {
    const sources = raw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    update("sources", sources);
  }

  async function handleSave() {
    const toSave: Article = {
      ...article,
      slug: article.slug || slugify(article.title),
    };
    setSaving(true);
    const startedAt = Date.now();
    try {
      const saved = await saveArticle(toSave);
      // A save that resolves near-instantly still shows the spinner for a
      // minimum stretch, so it reads as a deliberate state, not a flash.
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SAVE_SPINNER_MS) {
        await new Promise((r) => setTimeout(r, MIN_SAVE_SPINNER_MS - elapsed));
      }
      setArticle(saved);
      setSavedMessage("Saved");
      setTimeout(() => setSavedMessage(""), 2000);
      onSaved?.(saved);
    } catch {
      setSavedMessage("Save failed — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          ← Back
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {savedMessage && (
            <span
              className={`text-sm font-medium ${
                savedMessage === "Saved"
                  ? "text-emerald-600"
                  : "text-red-600"
              }`}
            >
              {savedMessage}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
          >
            {saving && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <h1 className="mt-4 text-2xl font-semibold text-ink">{heading}</h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-line bg-card p-5">
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
              placeholder="Article title"
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
              placeholder="Shown in search results"
            />
            <div className="mt-1">
              <CharCounter
                value={article.meta_description}
                min={120}
                max={158}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Target keyword</label>
              <input
                value={article.target_keyword}
                onChange={(e) => update("target_keyword", e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Intent</label>
              <input
                list="intent-options"
                value={article.search_intent}
                onChange={(e) => update("search_intent", e.target.value)}
                className={`${inputClass} mt-1`}
              />
              <datalist id="intent-options">
                {INTENT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Author name</label>
              <input
                value={article.author_name}
                onChange={(e) => update("author_name", e.target.value)}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Author credentials</label>
              <input
                value={article.author_credentials}
                onChange={(e) =>
                  update("author_credentials", e.target.value)
                }
                className={`${inputClass} mt-1`}
                placeholder="e.g. CFP, 8 yrs in lending"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Body (markdown)</label>
            <textarea
              value={article.body_markdown}
              onChange={(e) => updateBody(e.target.value)}
              rows={16}
              className={`${inputClass} mt-1 font-mono`}
            />
            <p className="mt-1 text-xs text-muted">
              {article.word_count} words
            </p>
          </div>

          {financeSite && (
            <div className="space-y-4 rounded-md border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Finance content requirements
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Reviewed by</label>
                  <input
                    value={article.reviewed_by ?? ""}
                    onChange={(e) =>
                      update("reviewed_by", e.target.value || null)
                    }
                    className={`${inputClass} mt-1`}
                    placeholder="e.g. R. Fernandes, CFP"
                  />
                </div>
                <div>
                  <label className={labelClass}>Reviewed date</label>
                  <input
                    type="date"
                    value={article.reviewed_at ?? ""}
                    onChange={(e) =>
                      update("reviewed_at", e.target.value || null)
                    }
                    className={`${inputClass} mt-1`}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Sources (one per line)</label>
                <textarea
                  value={article.sources.join("\n")}
                  onChange={(e) => updateSources(e.target.value)}
                  rows={3}
                  className={`${inputClass} mt-1 font-mono`}
                  placeholder="https://…"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={article.affiliate_disclosure === true}
                  onChange={(e) =>
                    update("affiliate_disclosure", e.target.checked)
                  }
                  className="h-4 w-4 rounded border-line"
                />
                Affiliate disclosure included on page
              </label>
            </div>
          )}

          <div className="rounded-md border border-line p-3">
            <p className="text-sm font-semibold text-ink">
              Score: {score} / 100
            </p>
            {gate.duplicateOf.length > 0 && (
              <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                Duplicate content — matches:{" "}
                {gate.duplicateOf
                  .map(
                    (id) =>
                      allArticles.find((a) => a.id === id)?.title ?? id,
                  )
                  .join(", ")}
              </p>
            )}
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

          <div className="rounded-md border border-line p-3">
            <p className="text-sm font-semibold text-ink">
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
              className="mt-3 inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-muted dark:disabled:bg-gray-700 dark:disabled:text-muted"
            >
              Publish
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-card p-5">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
            <EyeIcon className="h-3.5 w-3.5" />
            Live preview
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">
            {article.title || (
              <span className="text-muted">Untitled article</span>
            )}
          </h2>
          <div className="prose prose-sm mt-4 max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.body_markdown || "*Start writing to see a preview…*"}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
