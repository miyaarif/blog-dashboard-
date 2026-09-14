import { getSites, getArticles } from "@/lib/sites";
import Link from "next/link";
import DashboardCharts from "@/components/DashboardCharts";
import { DocumentIcon, GlobeIcon, TrendingUpIcon, AlertIcon } from "@/components/icons";
import AnimatedStatCard from "@/components/dashboard/AnimatedStatCard";
import AnimatedSiteCard from "@/components/dashboard/AnimatedSiteCard";
import EntranceWrapper from "@/components/dashboard/EntranceWrapper";
import {
  STATUS_ORDER,
  countsByStatusPerSite,
  publishedPerWeekBySite,
  articlesCreatedPerDay,
  articlesPublishedPerDay,
} from "@/lib/dashboardStats";

export const dynamic = "force-dynamic";

// Same real, validated categorical palette DashboardCharts.tsx uses for
// per-site bars -- duplicated here (not imported) so this page's cards
// don't take a dependency on that component's internals for one constant.
const SITE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  outlined: "Outlined",
  drafted: "Drafted",
  needs_review: "Needs review",
  scheduled: "Scheduled",
  published: "Published",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function Home() {
  const sites = await getSites();
  const articles = await getArticles();

  const publishedCount = articles.filter((a) => a.status === "published").length;
  const needsReviewCount = articles.filter((a) => a.status === "needs_review").length;
  const totalSessions = articles.reduce((sum, a) => sum + a.organic_sessions_30d, 0);

  // ---- real data for the top stat row's insights + hover reveals ----
  const now = Date.now();
  const sevenDaysAgo = now - 7 * MS_PER_DAY;

  const createdLast7 = articles.filter(
    (a) => new Date(a.created_at).getTime() >= sevenDaysAgo,
  ).length;
  const publishedLast7 = articles.filter(
    (a) => a.published_at && new Date(a.published_at).getTime() >= sevenDaysAgo,
  ).length;
  const staleNeedsReview = articles.filter(
    (a) =>
      a.status === "needs_review" &&
      new Date(a.created_at).getTime() < sevenDaysAgo,
  ).length;

  // Real per-site session totals -- organic_sessions_30d has no daily
  // breakdown anywhere in the schema, so the "Organic sessions" card's
  // hover reveal is a real per-site breakdown instead of a fabricated
  // daily trend line.
  const sessionsBySite = sites.map((site, i) => ({
    label: site.name,
    value: articles
      .filter((a) => a.site_id === site.id)
      .reduce((sum, a) => sum + a.organic_sessions_30d, 0),
    color: SITE_COLORS[i % SITE_COLORS.length],
  }));
  const topSessionsSite = sessionsBySite.reduce(
    (best, s) => (s.value > best.value ? s : best),
    sessionsBySite[0] ?? { label: "", value: 0, color: "" },
  );

  // Real per-site needs_review composition -- same reasoning as sessions:
  // this is a current snapshot, not a tracked-over-time metric (no
  // status-change history exists), so the hover reveal shows real
  // composition rather than an invented trend.
  const needsReviewBySite = sites.map((site, i) => ({
    label: site.name,
    value: articles.filter((a) => a.site_id === site.id && a.status === "needs_review").length,
    color: SITE_COLORS[i % SITE_COLORS.length],
  }));

  const createdPerDay = articlesCreatedPerDay(articles, 30).map((d) => d.count);
  const publishedPerDay = articlesPublishedPerDay(articles, 30).map((d) => d.count);

  const statInsights = {
    total:
      createdLast7 > 0
        ? `${createdLast7} article${createdLast7 === 1 ? "" : "s"} added in the last 7 days.`
        : "No new articles in the last 7 days.",
    published:
      publishedLast7 > 0
        ? `${publishedLast7} published in the last 7 days.`
        : "Nothing published in the last 7 days.",
    sessions:
      topSessionsSite.value > 0
        ? `${topSessionsSite.label} leads with ${topSessionsSite.value.toLocaleString()} sessions.`
        : "No organic sessions recorded yet.",
    needsReview:
      staleNeedsReview > 0
        ? `${staleNeedsReview} have been waiting over a week.`
        : "All caught up — nothing waiting long.",
  };

  // ---- real per-site data for the site cards ----
  const statusBySite = countsByStatusPerSite(articles);

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
        <AnimatedStatCard
          index={0}
          icon={<DocumentIcon className="h-5 w-5" />}
          label="Total articles"
          value={articles.length}
          sub="across the network"
          href="/articles"
          insight={statInsights.total}
          sparkline={{ kind: "line", values: createdPerDay }}
        />
        <AnimatedStatCard
          index={1}
          icon={<GlobeIcon className="h-5 w-5" />}
          label="Published"
          value={publishedCount}
          sub={`${sites.length} sites`}
          href="/articles?status=published"
          insight={statInsights.published}
          sparkline={{ kind: "line", values: publishedPerDay }}
        />
        <AnimatedStatCard
          index={2}
          icon={<TrendingUpIcon className="h-5 w-5" />}
          label="Organic sessions"
          value={totalSessions}
          sub="last 30 days"
          href="/articles?sort=sessions"
          insight={statInsights.sessions}
          sparkline={{ kind: "bars", items: sessionsBySite }}
        />
        <AnimatedStatCard
          index={3}
          icon={<AlertIcon className="h-5 w-5" />}
          label="Needs review"
          value={needsReviewCount}
          sub="awaiting a decision"
          href="/articles?status=needs_review"
          insight={statInsights.needsReview}
          sparkline={{ kind: "bars", items: needsReviewBySite }}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((site, i) => {
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
          const isHighestVolume =
            siteArticles.length > 0 &&
            sites.every(
              (other) =>
                other.id === site.id ||
                articles.filter((a) => a.site_id === other.id).length <= siteArticles.length,
            );

          const insight = onTarget
            ? isHighestVolume
              ? "On pace, and the highest volume in the network."
              : `On pace, hitting ${weeklyRate.toFixed(1)}/week.`
            : `Behind target by ${(site.publishing_cadence_per_week - weeklyRate).toFixed(1)} posts/week.`;

          const counts = statusBySite.find((b) => b.siteId === site.id)?.counts ?? {};
          const statusBreakdown = STATUS_ORDER.map((status) => ({
            label: STATUS_LABELS[status],
            value: counts[status] ?? 0,
            color: SITE_COLORS[i % SITE_COLORS.length],
          }));
          const weeklyTrend = publishedPerWeekBySite(articles, site.id).map((w) => w.count);

          return (
            <AnimatedSiteCard
              key={site.id}
              site={site}
              index={4 + i}
              articleCount={siteArticles.length}
              publishedCount={sitePublished}
              trafficSessions={siteTraffic}
              onTarget={onTarget}
              insight={insight}
              statusBreakdown={statusBreakdown}
              weeklyTrend={weeklyTrend}
            />
          );
        })}

        <EntranceWrapper index={4 + sites.length}>
          <Link
            href="/sites/new"
            className="group flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line p-5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent min-h-full"
          >
            <span className="text-xl leading-none" aria-hidden>
              +
            </span>
            Add site
          </Link>
        </EntranceWrapper>
      </div>

      <DashboardCharts sites={sites} articles={articles} />
    </div>
  );
}
