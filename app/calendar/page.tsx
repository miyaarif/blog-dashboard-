import Link from "next/link";
import { getArticles, getSites } from "@/lib/sites";
import { groupByDate, findCollisions, findGaps, gapSeverity } from "@/lib/calendarStats";
import SiteBadge from "@/components/SiteBadge";
import CalendarGrid from "@/components/CalendarGrid";
import { AlertIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [articles, sites] = await Promise.all([getArticles(), getSites()]);
  const sitesById = new Map(sites.map((s) => [s.id, s]));

  const byDate = groupByDate(articles);
  const collisions = findCollisions(byDate);
  const gaps = findGaps(byDate);
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

      <div className="mt-6">
        <CalendarGrid byDate={byDate} sites={sites} />
      </div>
    </div>
  );
}
