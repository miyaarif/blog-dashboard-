import { getArticles, getSiteById } from "@/lib/sites";

export default function CalendarPage() {
  const articles = getArticles();

  // group by scheduled_for or published_at date
  const dated = articles.filter((a) => a.scheduled_for || a.published_at);

  const byDate: Record<string, typeof articles> = {};
  dated.forEach((a) => {
    const date = (a.scheduled_for || a.published_at)!.split("T")[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(a);
  });

  const sortedDates = Object.keys(byDate).sort();

  // find collisions: more than one article on the same date
  const collisions = sortedDates.filter((d) => byDate[d].length > 1);

  // find gaps: more than 3 days between consecutive publish dates
  const gaps: string[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 3) {
      gaps.push(
        `${sortedDates[i - 1]} → ${sortedDates[i]} (${Math.round(diffDays)} days)`,
      );
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Publishing calendar</h1>

      {collisions.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #dc2626",
            borderRadius: 6,
          }}
        >
          <strong style={{ color: "#dc2626" }}>
            Collisions ({collisions.length} dates)
          </strong>
          <ul>
            {collisions.map((d) => (
              <li key={d} style={{ fontSize: 13 }}>
                {d}: {byDate[d].map((a) => a.title).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {gaps.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #f59e0b",
            borderRadius: 6,
          }}
        >
          <strong style={{ color: "#f59e0b" }}>Gaps ({gaps.length})</strong>
          <ul>
            {gaps.map((g) => (
              <li key={g} style={{ fontSize: 13 }}>
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>All scheduled/published dates</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Date</th>
            <th style={{ textAlign: "left" }}>Site</th>
            <th style={{ textAlign: "left" }}>Article</th>
          </tr>
        </thead>
        <tbody>
          {sortedDates.map((date) =>
            byDate[date].map((a) => {
              const site = getSiteById(a.site_id);
              return (
                <tr key={a.id} style={{ borderTop: "1px solid #333" }}>
                  <td>{date}</td>
                  <td>{site?.name}</td>
                  <td>{a.title}</td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}
