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
  "block w-full rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink focus:border-line focus:outline-none";
const labelClass = "block text-sm font-medium text-ink";

interface CreatedKeyword {
  id: number;
  keyword: string;
  site_id: string;
}

export default function AddKeywordForm({ sites }: { sites: Site[] }) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [keyword, setKeyword] = useState("");
  const [monthlyVolume, setMonthlyVolume] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [intent, setIntent] = useState(INTENT_OPTIONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedKeyword | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setCreated(null);

    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: siteId,
          keyword,
          monthly_volume: monthlyVolume,
          difficulty,
          intent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Something went wrong");
      } else {
        setCreated({ id: data.id, keyword: data.keyword, site_id: data.site_id });
        setKeyword("");
        setMonthlyVolume("");
        setDifficulty("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/keywords" className="text-sm text-muted hover:text-ink">
        ← Back to keywords
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-ink">Add keyword</h1>
      <p className="mt-1 text-sm text-muted">
        Inserts a real row into the keywords table. Volume and difficulty
        must come from a real keyword-research source — don&apos;t guess or
        estimate them.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-lg border border-line bg-card p-5"
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
          <label className={labelClass}>Keyword</label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="e.g. private student loan refinancing"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Monthly volume</label>
            <input
              type="number"
              min={0}
              value={monthlyVolume}
              onChange={(e) => setMonthlyVolume(e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="Real figure from your keyword tool"
              required
            />
          </div>
          <div>
            <label className={labelClass}>Difficulty (0–100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className={`${inputClass} mt-1`}
              placeholder="Real figure from your keyword tool"
              required
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Intent</label>
          <select
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            className={`${inputClass} mt-1`}
          >
            {INTENT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
          >
            {submitting && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Adding…" : "Add keyword"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {created && (
        <div className="mt-4 rounded-lg border border-line bg-card p-5">
          <p className="text-sm font-semibold text-ink">
            &quot;{created.keyword}&quot; added (id {created.id})
          </p>
          <Link
            href="/keywords"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent-soft"
          >
            View keywords →
          </Link>
        </div>
      )}
    </div>
  );
}
