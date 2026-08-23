import { getSites, getArticles } from "@/lib/sites";
import Link from "next/link";
import SiteBadge from "@/components/SiteBadge";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sites = await getSites();
  const articles = await getArticles();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Network overview
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {sites.length} sites &middot; {articles.length} articles across
            the network
          </p>
        </div>
        <Link
          href="/articles"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
        >
          View all articles
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              className="group rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <SiteBadge site={site} />
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    onTarget
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {onTarget ? "On target" : "Behind target"}
                </span>
              </div>

              <div className="mt-4 text-3xl font-semibold text-gray-900">
                {siteArticles.length}
                <span className="ml-1.5 text-sm font-normal text-gray-400">
                  articles
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {publishedCount} published &middot; {totalTraffic} sessions /
                30d
              </div>

              <div className="mt-4 flex items-center gap-1 text-sm font-medium text-gray-500 group-hover:text-gray-900">
                View site
                <span aria-hidden>→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
