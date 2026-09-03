import Link from "next/link";
import { getArticlesByStatus, getSites } from "@/lib/sites";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const [articles, sites] = await Promise.all([
    getArticlesByStatus("needs_review"),
    getSites(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold text-ink">Review queue</h1>
      <p className="mt-1 text-sm text-muted">
        {articles.length} article{articles.length === 1 ? "" : "s"} waiting
        for review
      </p>

      <div className="mt-6 divide-y divide-gray-100 rounded-lg border border-line bg-card">
        {articles.map((a) => {
          const site = sites.find((s) => s.id === a.site_id);
          return (
            <Link
              key={a.id}
              href={`/review-queue/${a.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-accent-soft"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{a.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  {site && <SiteBadge site={site} />}
                  <StatusPill status={a.status} />
                </div>
              </div>
              <span className="shrink-0 text-sm text-muted">Review →</span>
            </Link>
          );
        })}
        {articles.length === 0 && (
          <div className="p-10 text-center text-sm text-muted">
            Nothing waiting for review.
          </div>
        )}
      </div>
    </div>
  );
}
