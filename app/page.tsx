import { getSites, getArticles } from "@/lib/sites";
import Link from "next/link";
import SiteBadge from "@/components/SiteBadge";
import DashboardCharts from "@/components/DashboardCharts";
import { DocumentIcon, GlobeIcon, TrendingUpIcon, AlertIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  href: string;
}

function StatCard({ icon, label, value, sub, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-line bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
          {icon}
        </div>
        <span
          aria-hidden
          className="text-muted opacity-0 transition-opacity group-hover:opacity-100"
        >
          →
        </span>
      </div>
      <p className="mt-3 text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
    </Link>
  );
}

export default async function Home() {
  const sites = await getSites();
  const articles = await getArticles();

  const publishedCount = articles.filter((a) => a.status === "published").length;
  const needsReviewCount = articles.filter((a) => a.status === "needs_review").length;
  const totalSessions = articles.reduce((sum, a) => sum + a.organic_sessions_30d, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Network overview</h1>
          <p className="mt-1 text-sm text-muted">
            {sites.length} sites &middot; {articles.length} articles across
            the network
          </p>
        </div>
        <Link
          href="/articles"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          View all articles
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DocumentIcon className="h-5 w-5" />}
          label="Total articles"
          value={articles.length}
          sub="across the network"
          href="/articles"
        />
        <StatCard
          icon={<GlobeIcon className="h-5 w-5" />}
          label="Published"
          value={publishedCount}
          sub={`${sites.length} sites`}
          href="/articles?status=published"
        />
        <StatCard
          icon={<TrendingUpIcon className="h-5 w-5" />}
          label="Organic sessions"
          value={totalSessions}
          sub="last 30 days"
          href="/articles?sort=sessions"
        />
        <StatCard
          icon={<AlertIcon className="h-5 w-5" />}
          label="Needs review"
          value={needsReviewCount}
          sub="awaiting a decision"
          href="/articles?status=needs_review"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => {
          const siteArticles = articles.filter((a) => a.site_id === site.id);
          const sitePublished = siteArticles.filter(
            (a) => a.status === "published",
          ).length;
          const siteTraffic = siteArticles.reduce(
            (sum, a) => sum + a.organic_sessions_30d,
            0,
          );

          // rough weekly published rate: published articles / assume network has been running ~10 weeks
          const weeksRunning = 10;
          const weeklyRate = sitePublished / weeksRunning;
          const onTarget = weeklyRate >= site.publishing_cadence_per_week;

          return (
            <Link
              key={site.id}
              href={`/sites/${site.id}`}
              className="group rounded-xl border border-line bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <SiteBadge site={site} />
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    onTarget
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                      : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                  }`}
                >
                  {onTarget ? "On target" : "Behind target"}
                </span>
              </div>

              <div className="mt-4 text-3xl font-semibold text-ink">
                {siteArticles.length}
                <span className="ml-1.5 text-sm font-normal text-muted">
                  articles
                </span>
              </div>
              <div className="mt-1 text-sm text-muted">
                {sitePublished} published &middot; {siteTraffic} sessions /
                30d
              </div>

              <div className="mt-4 flex items-center gap-1 text-sm font-medium text-muted group-hover:text-accent">
                View site
                <span aria-hidden>→</span>
              </div>
            </Link>
          );
        })}
      </div>

      <DashboardCharts sites={sites} articles={articles} />
    </div>
  );
}
