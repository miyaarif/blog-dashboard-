"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { SpinnerIcon, AlertIcon } from "@/components/icons";

const MONETISATION_OPTIONS = [
  { value: "services", label: "Services" },
  { value: "affiliate", label: "Affiliate" },
  { value: "lead_gen", label: "Lead gen" },
];

// A small palette of visually distinct, accessible colours. The 3 real
// sites' colours look hand-picked, not generated from a formula, so this
// is a starting suggestion the person can override, not an attempt to
// reverse-engineer how HME/ScholarRoads/Fuel were chosen.
const COLOUR_PALETTE = [
  "#dc2626", // red
  "#ea580c", // orange
  "#ca8a04", // amber
  "#16a34a", // green
  "#0891b2", // cyan
  "#2563eb", // blue
  "#7c3aed", // purple
  "#db2777", // pink
];

function suggestColour(usedColours: string[]): string {
  const used = new Set(usedColours.map((c) => c.toLowerCase()));
  const free = COLOUR_PALETTE.find((c) => !used.has(c.toLowerCase()));
  return free ?? COLOUR_PALETTE[0];
}

const inputClass =
  "block w-full rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink focus:border-line focus:outline-none";
const labelClass = "block text-sm font-medium text-ink";

interface CreatedSite {
  id: string;
  name: string;
}

export default function CreateSiteForm({
  usedColours,
}: {
  usedColours: string[];
}) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [vertical, setVertical] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [monetisation, setMonetisation] = useState(MONETISATION_OPTIONS[0].value);
  const [cadence, setCadence] = useState(3);
  const [colour, setColour] = useState(() => suggestColour(usedColours));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedSite | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setCreated(null);

    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domain,
          vertical,
          description,
          audience,
          monetisation,
          publishing_cadence_per_week: cadence,
          primary_colour: colour,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Something went wrong");
      } else {
        setCreated({ id: data.id, name: data.name });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold text-ink">Add site</h1>
      <p className="mt-1 text-sm text-muted">
        Creates a real row in the sites table. It appears everywhere sites
        are shown as soon as it&apos;s created — Overview, Create, Articles,
        Keywords, and the Blog nav.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-lg border border-line bg-card p-5"
      >
        <div>
          <label className={labelClass}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="e.g. Acme Capital"
            required
          />
        </div>

        <div>
          <label className={labelClass}>Domain</label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="e.g. acmecapital.com"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Monetisation</label>
            <select
              value={monetisation}
              onChange={(e) => setMonetisation(e.target.value)}
              className={`${inputClass} mt-1`}
            >
              {MONETISATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Publishing cadence (per week)</label>
            <input
              type="number"
              min={1}
              value={cadence}
              onChange={(e) => setCadence(Number(e.target.value))}
              className={`${inputClass} mt-1`}
              required
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Primary colour</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-9 w-14 shrink-0 cursor-pointer rounded-md border border-line bg-card"
            />
            <input
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className={inputClass}
              placeholder="#2563eb"
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            Suggested to avoid clashing with existing sites — change it if
            you have a real brand colour.
          </p>
        </div>

        <div>
          <label className={labelClass}>Vertical (optional)</label>
          <input
            value={vertical}
            onChange={(e) => setVertical(e.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="e.g. Small Business Financing"
          />
        </div>

        <div>
          <label className={labelClass}>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} mt-1`}
            rows={2}
          />
        </div>

        <div>
          <label className={labelClass}>Audience (optional)</label>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className={`${inputClass} mt-1`}
            placeholder="e.g. SMB owners, $20k+/mo revenue"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
          >
            {submitting && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? "Creating…" : "Create site"}
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
            {created.name} created ({created.id})
          </p>
          <Link
            href={`/sites/${created.id}`}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent-soft"
          >
            View site →
          </Link>
        </div>
      )}
    </div>
  );
}
