import { use } from "react";
import Link from "next/link";
import { getSiteById, getArticlesBySite, getKeywordsBySite } from "@/lib/sites";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import { EyeIcon, PencilIcon } from "@/components/icons";

export default function SitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const site = getSiteById(siteId);

  if (!site) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-sm text-gray-600">Site not found.</p>
      </div>
    );
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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back to overview
      </Link>

      <div className="mt-4">
        <SiteBadge site={site} />
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">
          {site.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{site.description}</p>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Status breakdown
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
          >
            <StatusPill status={status} />
            <span className="text-sm font-medium text-gray-900">{count}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Top performers
      </h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        {topPerformers.map((a, i) => (
          <div
            key={a.id}
            className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${
              i !== topPerformers.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <Link
              href={`/articles/${a.id}`}
              className="font-medium text-gray-900 hover:underline"
            >
              {a.title}
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-gray-500">
                {a.organic_sessions_30d} sessions/30d
              </span>
              <Link
                href={`/articles/${a.id}`}
                title="Read article"
                className="inline-flex items-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <EyeIcon className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/editor/${a.id}`}
                title="Edit article"
                className="inline-flex items-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
        {topPerformers.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            No articles yet.
          </div>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Keywords ({keywords.length})
      </h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Keyword
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Volume
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Position
                </th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((k) => (
                <tr
                  key={k.keyword}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-gray-900">{k.keyword}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {k.monthly_volume}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {k.current_position ?? "unranked"}
                  </td>
                </tr>
              ))}
              {keywords.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No keywords assigned.
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
