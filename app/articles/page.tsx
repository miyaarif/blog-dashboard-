"use client";

import { useState } from "react";
import Link from "next/link";
import { getSites, getArticles } from "@/lib/sites";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";

export default function ArticlesPage() {
  const sites = getSites();
  const articles = getArticles();

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
    <div style={{ padding: 24 }}>
      <h1>Articles ({filtered.length})</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
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
        >
          <option value="all">All statuses</option>
          <option value="idea">idea</option>
          <option value="outlined">outlined</option>
          <option value="drafted">drafted</option>
          <option value="needs_review">needs_review</option>
          <option value="scheduled">scheduled</option>
          <option value="published">published</option>
        </select>

        <input
          placeholder="Search title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button onClick={exportToCSV}>Export CSV</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8 }}>Title</th>
            <th style={{ textAlign: "left", padding: 8 }}>Site</th>
            <th style={{ textAlign: "left", padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => {
            const site = sites.find((s) => s.id === a.site_id);
            return (
              <tr key={a.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={{ padding: 8 }}>
                  <Link href={`/articles/${a.id}`}>{a.title}</Link>
                  {" — "}
                  <Link href={`/editor/${a.id}`}>edit</Link>
                </td>
                <td style={{ padding: 8 }}>
                  {site && <SiteBadge site={site} />}
                </td>
                <td style={{ padding: 8 }}>
                  <StatusPill status={a.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
