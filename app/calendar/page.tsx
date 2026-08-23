import Link from "next/link";
import { getArticles, getSites } from "@/lib/sites";
import SiteBadge from "@/components/SiteBadge";
import { AlertIcon } from "@/components/icons";

function gapSeverity(days: number): { label: string; classes: string } {
  if (days >= 14) return { label: "Critical", classes: "bg-red-50 text-red-700" };
  if (days >= 7) return { label: "Warning", classes: "bg-amber-50 text-amber-700" };
  return { label: "Minor", classes: "bg-gray-100 text-gray-600" };
}

export default async function CalendarPage() {
  const [articles, sites] = await Promise.all([getArticles(), getSites()]);
  const sitesById = new Map(sites.map((s) => [s.id, s]));

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
  const gaps: { from: string; to: string; days: number }[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 3) {
      gaps.push({
        from: sortedDates[i - 1],
        to: sortedDates[i],
        days: Math.round(diffDays),
      });
    }
  }
  const worstGap = gaps.reduce((max, g) => Math.max(max, g.days), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        Publishing calendar
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Scheduled and published dates across the network.
      </p>

      {(collisions.length > 0 || gaps.length > 0) && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {collisions.length > 0 && (
            <div className="flex max-h-96 flex-col overflow-hidden rounded-lg border border-red-200 bg-white">
              <div className="flex shrink-0 items-center justify-between border-b border-red-100 bg-red-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertIcon className="h-4 w-4 text-red-600" />
                  <p className="text-sm font-semibold text-red-700">
                    Collisions
                  </p>
                </div>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {collisions.length} {collisions.length === 1 ? "date" : "dates"}
                </span>
              </div>
              <div className="overflow-y-auto">
                {collisions.map((d) => (
                  <div
                    key={d}
                    className="border-b border-gray-100 px-4 py-3 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{d}</p>
                      <span className="text-xs text-gray-400">
                        {byDate[d].length} articles
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {byDate[d].map((a) => {
                        const site = sitesById.get(a.site_id);
                        return (
                          <li key={a.id} className="flex items-center gap-2">
                            {site && <SiteBadge site={site} />}
                            <Link
                              href={`/articles/${a.id}`}
                              className="truncate text-xs text-gray-600 hover:text-gray-900 hover:underline"
                            >
                              {a.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gaps.length > 0 && (
            <div className="flex max-h-96 flex-col overflow-hidden rounded-lg border border-amber-200 bg-white">
              <div className="flex shrink-0 items-center justify-between border-b border-amber-100 bg-amber-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertIcon className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-700">Gaps</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {gaps.length} &middot; worst {worstGap}d
                </span>
              </div>
              <div className="overflow-y-auto">
                {gaps.map((g) => {
                  const severity = gapSeverity(g.days);
                  return (
                    <div
                      key={`${g.from}-${g.to}`}
                      className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 text-sm last:border-0"
                    >
                      <span className="text-gray-700">
                        {g.from} <span className="text-gray-300">→</span>{" "}
                        {g.to}
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${severity.classes}`}
                      >
                        {g.days}d
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500">
        All scheduled / published dates
      </h2>

      {/* Desktop / tablet table */}
      <div className="mt-3 hidden overflow-hidden rounded-lg border border-gray-200 bg-white sm:block">
        <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Site
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Article
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedDates.map((date) =>
                byDate[date].map((a) => {
                  const site = sitesById.get(a.site_id);
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-600">{date}</td>
                      <td className="px-4 py-3">
                        {site && <SiteBadge site={site} />}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/articles/${a.id}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {a.title}
                        </Link>
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mt-3 max-h-[480px] divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white sm:hidden">
        {sortedDates.map((date) =>
          byDate[date].map((a) => {
            const site = sitesById.get(a.site_id);
            return (
              <div key={a.id} className="p-4">
                <p className="text-xs text-gray-400">{date}</p>
                <Link
                  href={`/articles/${a.id}`}
                  className="mt-1 block font-medium text-gray-900 hover:underline"
                >
                  {a.title}
                </Link>
                <div className="mt-1.5">{site && <SiteBadge site={site} />}</div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
