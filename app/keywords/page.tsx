import Link from "next/link";
import { getKeywords, getSites } from "@/lib/sites";
import SiteBadge from "@/components/SiteBadge";

export const dynamic = "force-dynamic";

export default async function KeywordsPage() {
  const [keywords, sites] = await Promise.all([getKeywords(), getSites()]);
  const sitesById = new Map(sites.map((s) => [s.id, s]));

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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Back to overview
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-ink">
        Keyword opportunities ({unassigned.length})
      </h1>
      <p className="mt-1 text-sm text-muted">
        Unassigned keywords, ranked by monthly search volume.
      </p>

      {cannibalization.length > 0 && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Keyword cannibalization ({cannibalization.length})
          </p>
          <ul className="mt-2 space-y-1">
            {cannibalization.map(([key, kws]) => (
              <li key={key} className="text-xs text-red-700 dark:text-red-400">
                &quot;{kws[0].keyword}&quot; assigned to articles:{" "}
                {kws.map((k) => k.assigned_article_id).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Desktop / tablet table */}
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-line bg-card sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line bg-page">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Keyword
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Site
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Volume
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Difficulty
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Intent
                </th>
              </tr>
            </thead>
            <tbody>
              {unassigned.map((k) => {
                const site = sitesById.get(k.site_id);
                return (
                  <tr
                    key={k.keyword}
                    className="border-b border-line last:border-0 hover:bg-accent-soft"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {k.keyword}
                    </td>
                    <td className="px-4 py-3">
                      {site && <SiteBadge site={site} />}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {k.monthly_volume}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {k.difficulty}
                    </td>
                    <td className="px-4 py-3 text-muted">{k.intent}</td>
                  </tr>
                );
              })}
              {unassigned.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-muted"
                  >
                    No unassigned keywords.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-line bg-card sm:hidden">
        {unassigned.map((k) => {
          const site = sitesById.get(k.site_id);
          return (
            <div key={k.keyword} className="p-4">
              <p className="font-medium text-ink">{k.keyword}</p>
              <div className="mt-1.5">{site && <SiteBadge site={site} />}</div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>Volume: {k.monthly_volume}</span>
                <span>Difficulty: {k.difficulty}</span>
                <span>Intent: {k.intent}</span>
              </div>
            </div>
          );
        })}
        {unassigned.length === 0 && (
          <div className="p-8 text-center text-sm text-muted">
            No unassigned keywords.
          </div>
        )}
      </div>
    </div>
  );
}
