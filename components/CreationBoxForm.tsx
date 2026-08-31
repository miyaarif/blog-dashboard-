"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { Site } from "@/types";
import { SpinnerIcon, AlertIcon } from "@/components/icons";

const INTENT_OPTIONS = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
];

const inputClass =
  "block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none";
const labelClass = "block text-sm font-medium text-gray-700";

interface LoopTriggerResult {
  article_id?: string;
  outcome?: "passed" | "failed_after_retries" | "error";
  attempts_used?: number;
  first_score?: number | null;
  final_score?: number | null;
}

function parseCommaList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CreationBoxForm({
  sites,
  isLocal,
}: {
  sites: Site[];
  isLocal: boolean;
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [searchIntent, setSearchIntent] = useState("informational");
  const [keywordsText, setKeywordsText] = useState("");
  const [brandNamesText, setBrandNamesText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LoopTriggerResult | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/loop-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: siteId,
          title,
          target_keyword: targetKeyword,
          search_intent: searchIntent,
          keywords: parseCommaList(keywordsText),
          brand_names: parseCommaList(brandNamesText),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Something went wrong");
      } else {
        setResult(data as LoopTriggerResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Create article</h1>
      <p className="mt-1 text-sm text-gray-500">
        Runs the writer → grader retry loop (up to 3 attempts) and drops the
        result in the review queue.
      </p>

      {!isLocal && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The writer/grader loop is local-only for now — it can outlast
            Vercel Hobby&apos;s function timeout. Run the dashboard locally
            (<code className="font-mono">npm run dev</code>) to generate an
            article.
          </span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-5"
      >
        <div>
          <label className={labelClass}>Site</label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="Article title"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Target keyword</label>
            <input
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              className={`${inputClass} mt-1`}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Intent</label>
            <input
              list="intent-options"
              value={searchIntent}
              onChange={(e) => setSearchIntent(e.target.value)}
              className={`${inputClass} mt-1`}
            />
            <datalist id="intent-options">
              {INTENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Supporting keywords (comma-separated)
          </label>
          <input
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="e.g. student loan refinancing, private lenders"
          />
        </div>

        <div>
          <label className={labelClass}>
            Brand names (comma-separated, can be empty)
          </label>
          <input
            value={brandNamesText}
            onChange={(e) => setBrandNamesText(e.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="e.g. College Ave, Sallie Mae"
          />
          <p className="mt-1 text-xs text-gray-400">
            Each name must exactly match an active row in the brands table,
            or the job is refused.
          </p>
        </div>

        <div>
          <button
            type="submit"
            disabled={submitting || !isLocal}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {submitting && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Running writer → grader loop…" : "Generate"}
          </button>
          {submitting && (
            <p className="mt-2 text-xs text-gray-400">
              This can take several minutes — up to 3 attempts, each a writer
              call and a grader call.
            </p>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-900">
            Outcome: {result.outcome ?? "unknown"}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-600 sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Attempts
              </dt>
              <dd>{result.attempts_used ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                First score
              </dt>
              <dd>{result.first_score ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Final score
              </dt>
              <dd>{result.final_score ?? "—"}</dd>
            </div>
          </dl>
          {result.article_id && (
            <Link
              href={`/review-queue/${result.article_id}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View in review queue →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
