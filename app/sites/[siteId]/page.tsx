import { use } from "react";
import Link from "next/link";
import { getSiteById, getArticlesBySite, getKeywordsBySite } from "@/lib/sites";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";

export default function SitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const site = getSiteById(siteId);

  if (!site) {
    return <div style={{ padding: 24 }}>Site not found.</div>;
  }

  const articles = getArticlesBySite(siteId);
  const keywords = getKeywordsBySite(siteId);

  const statusCounts: Record<string, number> = {};
  articles.forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  });

  const topPerformers = [...articles]
    .sort((a, b) => b.organic_sessions_30d - a.organic_sessions_30d)
    .slice(0, 5);

  return (
    <div style={{ padding: 24 }}>
      <Link href="/">← Back to overview</Link>

      <div style={{ marginTop: 16 }}>
        <SiteBadge site={site} />
      </div>
      <h1>{site.name}</h1>
      <p style={{ color: "#888" }}>{site.description}</p>

      <h2 style={{ marginTop: 24 }}>Status breakdown</h2>
      <div style={{ display: "flex", gap: 8 }}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <StatusPill status={status} />
            <span>{count}</span>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 24 }}>Top performers</h2>
      <ol>
        {topPerformers.map((a) => (
          <li key={a.id}>
            <Link href={`/articles/${a.id}`}>{a.title}</Link> —{" "}
            {a.organic_sessions_30d} sessions/30d
          </li>
        ))}
      </ol>

      <h2 style={{ marginTop: 24 }}>Keywords ({keywords.length})</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Keyword</th>
            <th style={{ textAlign: "left" }}>Volume</th>
            <th style={{ textAlign: "left" }}>Position</th>
          </tr>
        </thead>
        <tbody>
          {keywords.map((k) => (
            <tr key={k.keyword} style={{ borderTop: "1px solid #333" }}>
              <td>{k.keyword}</td>
              <td>{k.monthly_volume}</td>
              <td>{k.current_position ?? "unranked"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
