import type { Article } from "@/types";

export const STATUS_ORDER = [
  "idea",
  "outlined",
  "drafted",
  "needs_review",
  "scheduled",
  "published",
] as const;

export interface StatusBySite {
  siteId: string;
  counts: Record<string, number>;
}

export function countsByStatusPerSite(articles: Article[]): StatusBySite[] {
  const bySite = new Map<string, Record<string, number>>();

  // rejected is a dead end, not forward pipeline progress — excluded here,
  // not just left out of STATUS_ORDER, so it can't inflate the chart's
  // Y-axis scale via Object.values(counts) even while staying undrawn.
  const forwardArticles = articles.filter((a) => a.status !== "rejected");

  for (const a of forwardArticles) {
    if (!bySite.has(a.site_id)) {
      const empty: Record<string, number> = {};
      for (const s of STATUS_ORDER) empty[s] = 0;
      bySite.set(a.site_id, empty);
    }
    const counts = bySite.get(a.site_id)!;
    counts[a.status] = (counts[a.status] ?? 0) + 1;
  }

  return Array.from(bySite.entries()).map(([siteId, counts]) => ({
    siteId,
    counts,
  }));
}

export interface DailyCount {
  date: string; // yyyy-mm-dd, UTC
  count: number;
}

// Shared day-bucketing for the two real daily series below -- zero-fills
// every day in the window (not just days with real activity), so a
// sparkline drawn from this always has a real, complete 30-point series.
function bucketByDay(dates: Date[], days: number): DailyCount[] {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const counts = new Map<string, number>();
  for (const d of dates) {
    if (d < start) continue;
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const result: DailyCount[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < days; i++) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ date: key, count: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

// Real, from articles.created_at -- backs the "Total articles" stat
// card's hover sparkline.
export function articlesCreatedPerDay(articles: Article[], days = 30): DailyCount[] {
  return bucketByDay(
    articles.map((a) => new Date(a.created_at)),
    days,
  );
}

// Real, from articles.published_at -- backs the "Published" stat card's
// hover sparkline.
export function articlesPublishedPerDay(articles: Article[], days = 30): DailyCount[] {
  return bucketByDay(
    articles.filter((a) => a.published_at).map((a) => new Date(a.published_at!)),
    days,
  );
}

export interface WeeklyPublishCount {
  weekStart: string; // yyyy-mm-dd, Monday of that week
  count: number;
}

export function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

// Real per-site version of publishedPerWeek -- filters to one site's real
// articles first, then reuses the same weekly bucketing so the two never
// drift apart. Added for the dashboard's per-site hover view.
export function publishedPerWeekBySite(
  articles: Article[],
  siteId: string,
): WeeklyPublishCount[] {
  return publishedPerWeek(articles.filter((a) => a.site_id === siteId));
}

export function publishedPerWeek(articles: Article[]): WeeklyPublishCount[] {
  const dated = articles
    .filter((a) => a.published_at)
    .map((a) => mondayOf(new Date(a.published_at!)));

  if (dated.length === 0) return [];

  const counts = new Map<string, number>();
  for (const monday of dated) {
    const key = monday.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const earliest = new Date(Math.min(...dated.map((d) => d.getTime())));
  const latest = new Date(Math.max(...dated.map((d) => d.getTime())));

  const weeks: WeeklyPublishCount[] = [];
  const cursor = new Date(earliest);
  while (cursor <= latest) {
    const key = cursor.toISOString().slice(0, 10);
    weeks.push({ weekStart: key, count: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return weeks;
}
