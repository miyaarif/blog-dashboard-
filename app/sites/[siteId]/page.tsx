import Link from "next/link";
import { getSiteById, getArticlesBySite, getKeywordsBySite } from "@/lib/sites";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import { EyeIcon, PencilIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SitePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await getSiteById(siteId);

  if (!site) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-sm text-muted">Site not found.</p>
      </div>
    );
  }

  const [articles, keywords] = await Promise.all([
    getArticlesBySite(siteId),
    getKeywordsBySite(siteId),
  ]);

  const statusCounts: Record<string, number> = {};
  articles.forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  });

  const topPerformers = [...articles]
    .sort((a, b) => b.organic_sessions_30d - a.organic_sessions_30d)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Back to overview
      </Link>

      <div className="mt-4">
        <SiteBadge site={site} />
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          {site.name}
        </h1>
        <p className="mt-1 text-sm text-muted">{site.description}</p>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">
        Status breakdown
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div
            key={status}
            className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2"
          >
            <StatusPill status={status} />
            <span className="text-sm font-medium text-ink">{count}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">
        Top performers
      </h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-line bg-card">
        {topPerformers.map((a, i) => (
          <div
            key={a.id}
            className={`flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
              i !== topPerformers.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <Link
              href={`/articles/${a.id}`}
              className="font-medium text-ink hover:underline"
            >
              {a.title}
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-muted">
                {a.organic_sessions_30d} sessions/30d
              </span>
              <Link
                href={`/articles/${a.id}`}
                title="Read article"
                className="inline-flex items-center rounded-md p-1.5 text-muted hover:bg-accent-soft hover:text-ink"
              >
                <EyeIcon className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/editor/${a.id}`}
                title="Edit article"
                className="inline-flex items-center rounded-md p-1.5 text-muted hover:bg-accent-soft hover:text-ink"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
        {topPerformers.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted">
            No articles yet.
          </div>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-muted">
        Keywords ({keywords.length})
      </h2>
      {/* Desktop / tablet table */}
      <div className="mt-3 hidden overflow-hidden rounded-lg border border-line bg-card sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-line bg-page">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Keyword
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Volume
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Position
                </th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((k) => (
                <tr
                  key={k.keyword}
                  className="border-b border-line last:border-0 hover:bg-accent-soft"
                >
                  <td className="px-4 py-3 text-ink">{k.keyword}</td>
                  <td className="px-4 py-3 text-muted">
                    {k.monthly_volume}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {k.current_position ?? "unranked"}
                  </td>
                </tr>
              ))}
              {keywords.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-muted"
                  >
                    No keywords assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-line bg-card sm:hidden">
        {keywords.map((k) => (
          <div
            key={k.keyword}
            className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
          >
            <span className="text-ink">{k.keyword}</span>
            <span className="shrink-0 text-xs text-muted">
              {k.monthly_volume} vol &middot;{" "}
              {k.current_position ?? "unranked"}
            </span>
          </div>
        ))}
        {keywords.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted">
            No keywords assigned.
          </div>
        )}
      </div>
    </div>
  );
}
