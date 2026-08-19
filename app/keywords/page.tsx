import Link from "next/link";
import { getKeywords, getSiteById } from "@/lib/sites";

export default function KeywordsPage() {
  const keywords = getKeywords();

  const unassigned = keywords
    .filter((k) => k.assigned_article_id === null)
    .sort((a, b) => b.monthly_volume - a.monthly_volume);

  const bySiteKeyword: Record<string, typeof keywords> = {};
  keywords
    .filter((k) => k.assigned_article_id !== null)
    .forEach((k) => {
      const key = `${k.site_id}:${k.keyword.toLowerCase()}`;
      if (!bySiteKeyword[key]) bySiteKeyword[key] = [];
      bySiteKeyword[key].push(k);
    });

  const cannibalization = Object.entries(bySiteKeyword).filter(
    ([, kws]) => kws.length > 1,
  );

  return (
    <div style={{ padding: 24 }}>
      <Link href="/">← Back to overview</Link>
      <h1>Keyword opportunities ({unassigned.length})</h1>
      <p style={{ color: "#888" }}>
        Unassigned keywords, ranked by monthly search volume.
      </p>

      {cannibalization.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #dc2626",
            borderRadius: 6,
          }}
        >
          <strong style={{ color: "#dc2626" }}>
            Keyword cannibalization ({cannibalization.length})
          </strong>
          <ul>
            {cannibalization.map(([key, kws]) => (
              <li key={key} style={{ fontSize: 13 }}>
                &quot;{kws[0].keyword}&quot; assigned to articles:{" "}
                {kws.map((k) => k.assigned_article_id).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <table
        style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Keyword</th>
            <th style={{ textAlign: "left" }}>Site</th>
            <th style={{ textAlign: "left" }}>Volume</th>
            <th style={{ textAlign: "left" }}>Difficulty</th>
            <th style={{ textAlign: "left" }}>Intent</th>
          </tr>
        </thead>
        <tbody>
          {unassigned.map((k) => {
            const site = getSiteById(k.site_id);
            return (
              <tr key={k.keyword} style={{ borderTop: "1px solid #333" }}>
                <td>{k.keyword}</td>
                <td>{site?.name}</td>
                <td>{k.monthly_volume}</td>
                <td>{k.difficulty}</td>
                <td>{k.intent}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
