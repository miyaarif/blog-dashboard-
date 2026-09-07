"use client";

import { useState } from "react";
import Link from "next/link";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import type { Article, Site } from "@/types";

export default function ReviewQueueTable({
  sites,
  articles,
}: {
  sites: Site[];
  articles: Article[];
}) {
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");

  const filtered = articles.filter((a) => {
    if (siteFilter !== "all" && a.site_id !== siteFilter) return false;
    if (search) {
      const needle = search.toLowerCase();
      const matchesTitle = a.title.toLowerCase().includes(needle);
      const matchesKeyword = a.target_keyword.toLowerCase().includes(needle);
      if (!matchesTitle && !matchesKeyword) return false;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold text-ink">Review queue</h1>
      <p className="mt-1 text-sm text-muted">
        {filtered.length} of {articles.length} article
        {articles.length === 1 ? "" : "s"} waiting for review
      </p>

      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          placeholder="Search title or keyword…"
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
      </div>

      <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-line bg-card">
        {filtered.map((a) => {
          const site = sites.find((s) => s.id === a.site_id);
          return (
            <Link
              key={a.id}
              href={`/review-queue/${a.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-accent-soft"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{a.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  {site && <SiteBadge site={site} />}
                  <StatusPill status={a.status} />
                </div>
              </div>
              <span className="shrink-0 text-sm text-muted">Review →</span>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-muted">
            {articles.length === 0
              ? "Nothing waiting for review."
              : "No articles match these filters."}
          </div>
        )}
      </div>
    </div>
  );
}
