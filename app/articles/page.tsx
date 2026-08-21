"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSites, getArticles } from "@/lib/sites";
import { getArticlesWithLocalEdits } from "@/lib/storage";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import { EyeIcon, PencilIcon } from "@/components/icons";
import type { Article } from "@/types";

const STATUS_OPTIONS = [
  "idea",
  "outlined",
  "drafted",
  "needs_review",
  "scheduled",
  "published",
];

export default function ArticlesPage() {
  const sites = getSites();
  const [articles, setArticles] = useState<Article[]>(getArticles());

  useEffect(() => {
    setArticles(getArticlesWithLocalEdits(getArticles()));
  }, []);

  const [siteFilter, setSiteFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = articles.filter((a) => {
    if (siteFilter !== "all" && a.site_id !== siteFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

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
          <h1 className="text-2xl font-semibold text-gray-900">
            Articles
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {filtered.length} of {articles.length} articles
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Export CSV
          </button>
          <Link
            href="/editor/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            + New article
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          placeholder="Search title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none sm:min-w-[220px] sm:flex-1"
        />

        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none sm:w-auto"
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
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none sm:w-auto"
        >
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop / tablet table */}
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-gray-200 bg-white sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Site
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
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
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/articles/${a.id}`}
                        className="font-medium text-gray-900 hover:underline"
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/articles/${a.id}`}
                          title="Read article"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                          Read
                        </Link>
                        <Link
                          href={`/editor/${a.id}`}
                          title="Edit article"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
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
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-gray-400"
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
      <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white sm:hidden">
        {filtered.map((a) => {
          const site = sites.find((s) => s.id === a.site_id);
          return (
            <div key={a.id} className="p-4">
              <Link
                href={`/articles/${a.id}`}
                className="font-medium text-gray-900 hover:underline"
              >
                {a.title}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {site && <SiteBadge site={site} />}
                <StatusPill status={a.status} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={`/articles/${a.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  Read
                </Link>
                <Link
                  href={`/editor/${a.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                  Edit
                </Link>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">
            No articles match these filters.
          </div>
        )}
      </div>
    </div>
  );
}
