import Link from "next/link";
import { getKeywords, getSiteById } from "@/lib/sites";
import SiteBadge from "@/components/SiteBadge";

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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back to overview
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-gray-900">
        Keyword opportunities ({unassigned.length})
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Unassigned keywords, ranked by monthly search volume.
      </p>

      {cannibalization.length > 0 && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">
            Keyword cannibalization ({cannibalization.length})
          </p>
          <ul className="mt-2 space-y-1">
            {cannibalization.map(([key, kws]) => (
              <li key={key} className="text-xs text-red-700">
                &quot;{kws[0].keyword}&quot; assigned to articles:{" "}
                {kws.map((k) => k.assigned_article_id).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Keyword
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Site
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Volume
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Difficulty
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Intent
                </th>
              </tr>
            </thead>
            <tbody>
              {unassigned.map((k) => {
                const site = getSiteById(k.site_id);
                return (
                  <tr
                    key={k.keyword}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {k.keyword}
                    </td>
                    <td className="px-4 py-3">
                      {site && <SiteBadge site={site} />}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {k.monthly_volume}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {k.difficulty}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{k.intent}</td>
                  </tr>
                );
              })}
              {unassigned.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No unassigned keywords.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
