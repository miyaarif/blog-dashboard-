import { getSites, getArticles } from "@/lib/sites";
import Link from "next/link";
import SiteBadge from "@/components/SiteBadge";

export default function Home() {
  const sites = getSites();
  const articles = getArticles();

  return (
    <div style={{ padding: 24 }}>
      <h1>Network overview</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginTop: 16,
        }}
      >
        {sites.map((site) => {
          const siteArticles = articles.filter((a) => a.site_id === site.id);
          const publishedCount = siteArticles.filter(
            (a) => a.status === "published",
          ).length;
          const totalTraffic = siteArticles.reduce(
            (sum, a) => sum + a.organic_sessions_30d,
            0,
          );

          // rough weekly published rate: published articles / assume network has been running ~10 weeks
          const weeksRunning = 10;
          const weeklyRate = publishedCount / weeksRunning;
          const onTarget = weeklyRate >= site.publishing_cadence_per_week;

          return (
            <Link
              key={site.id}
              href={`/sites/${site.id}`}
              style={{
                display: "block",
                border: "1px solid #333",
                borderRadius: 8,
                padding: 16,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <SiteBadge site={site} />
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>
                {siteArticles.length} articles
              </div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                {publishedCount} published &middot; {totalTraffic} sessions/30d
              </div>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  fontSize: 12,
                  padding: "2px 8px",
                  borderRadius: 4,
                  backgroundColor: onTarget ? "#dcfce7" : "#fee2e2",
                  color: onTarget ? "#166534" : "#991b1b",
                }}
              >
                {onTarget ? "On target" : "Behind target"}
              </span>
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: 32 }}>
        <Link href="/articles">View all articles →</Link>
      </div>
    </div>
  );
}
