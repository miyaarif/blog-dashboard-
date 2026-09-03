"use client";

import { useState } from "react";
import Link from "next/link";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import HeroImage from "@/components/HeroImage";
import { EyeIcon, PencilIcon } from "@/components/icons";
import type { Article, Site } from "@/types";

const STATUS_OPTIONS = [
  "idea",
  "outlined",
  "drafted",
  "needs_review",
  "scheduled",
  "published",
  "rejected",
];

function formatDateLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

type SortKey = "none" | "sessions_desc" | "sessions_asc";

export default function ArticlesTable({
  sites,
  articles,
  initialSiteFilter,
  initialStatusFilter,
  initialFrom,
  initialTo,
  initialSearch,
  initialSort,
}: {
  sites: Site[];
  articles: Article[];
  initialSiteFilter?: string;
  initialStatusFilter?: string;
  initialFrom?: string;
  initialTo?: string;
  initialSearch?: string;
  initialSort?: string;
}) {
  const [siteFilter, setSiteFilter] = useState(initialSiteFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter ?? "all");
  const [search, setSearch] = useState(initialSearch ?? "");
  const [dateRange, setDateRange] = useState(
    initialFrom && initialTo ? { from: initialFrom, to: initialTo } : null,
  );
  const [sort, setSort] = useState<SortKey>(
    initialSort === "sessions" ? "sessions_desc" : "none",
  );

  const filtered = articles.filter((a) => {
    if (siteFilter !== "all" && a.site_id !== siteFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (dateRange) {
      if (!a.published_at) return false;
      const publishedDate = a.published_at.split("T")[0];
      if (publishedDate < dateRange.from || publishedDate > dateRange.to)
        return false;
    }
    return true;
  });

  if (sort !== "none") {
    filtered.sort((a, b) =>
      sort === "sessions_desc"
        ? b.organic_sessions_30d - a.organic_sessions_30d
        : a.organic_sessions_30d - b.organic_sessions_30d,
    );
  }

  function toggleSessionsSort() {
    setSort((prev) =>
      prev === "sessions_desc" ? "sessions_asc" : "sessions_desc",
    );
  }

  function exportToCSV() {
    const headers = ["Title", "Site", "Status", "Word Count", "Sessions (30d)"];
    const rows = filtered.map((a) => {
      const site = sites.find((s) => s.id === a.site_id);
      return [
        a.title,
        site?.name ?? "",
        a.status,
        a.word_count,
        a.organic_sessions_30d,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "articles.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            Articles
          </h1>
          <p className="mt-1 text-sm text-muted">
            {filtered.length} of {articles.length} articles
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent-soft"
          >
            Export CSV
          </button>
          <Link
            href="/editor/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            + New article
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-line bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          placeholder="Search title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-line px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-line focus:outline-none sm:min-w-[220px] sm:flex-1"
        />

        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="w-full rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink focus:border-line focus:outline-none sm:w-auto"
        >
          <option value="all">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink focus:border-line focus:outline-none sm:w-auto"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {dateRange && (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-ink dark:bg-gray-500/15 dark:text-gray-300">
            Published {formatDateLabel(dateRange.from)}–
            {formatDateLabel(dateRange.to)}
            <button
              type="button"
              onClick={() => setDateRange(null)}
              aria-label="Clear date filter"
              className="ml-0.5 text-muted hover:text-ink"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Desktop / tablet table */}
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-line bg-card sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line bg-page">
                <th className="w-16 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Site
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted">
                  <button
                    type="button"
                    onClick={toggleSessionsSort}
                    className="inline-flex items-center gap-1 hover:text-ink"
                  >
                    Sessions (30d)
                    {sort !== "none" && (
                      <span aria-hidden>
                        {sort === "sessions_desc" ? "↓" : "↑"}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const site = sites.find((s) => s.id === a.site_id);
                return (
                  <tr
                    key={a.id}
                    className="border-b border-line last:border-0 hover:bg-accent-soft"
                  >
                    <td className="px-4 py-3">
                      <HeroImage
                        src={a.hero_image_url}
                        alt={a.hero_image_alt ?? ""}
                        className="h-10 w-14 rounded object-cover"
                        fallbackClassName="h-10 w-14 rounded bg-gray-100 dark:bg-gray-700"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/articles/${a.id}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {site && <SiteBadge site={site} />}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-ink">
                      {a.organic_sessions_30d.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/articles/${a.id}`}
                          title="Read article"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-accent-soft hover:text-ink"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                          Read
                        </Link>
                        <Link
                          href={`/editor/${a.id}`}
                          title="Edit article"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-accent-soft hover:text-ink"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-muted"
                  >
                    No articles match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-line bg-card sm:hidden">
        {filtered.map((a) => {
          const site = sites.find((s) => s.id === a.site_id);
          return (
            <div key={a.id} className="flex gap-3 p-4">
              <HeroImage
                src={a.hero_image_url}
                alt={a.hero_image_alt ?? ""}
                className="h-14 w-20 shrink-0 rounded object-cover"
                fallbackClassName="h-14 w-20 shrink-0 rounded bg-gray-100 dark:bg-gray-700"
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/articles/${a.id}`}
                  className="font-medium text-ink hover:underline"
                >
                  {a.title}
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {site && <SiteBadge site={site} />}
                  <StatusPill status={a.status} />
                  <span className="text-xs text-muted">
                    {a.organic_sessions_30d.toLocaleString()} sessions/30d
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={`/articles/${a.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft"
                  >
                    <EyeIcon className="h-3.5 w-3.5" />
                    Read
                  </Link>
                  <Link
                    href={`/editor/${a.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted">
            No articles match these filters.
          </div>
        )}
      </div>
    </div>
  );
}
