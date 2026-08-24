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

  for (const a of articles) {
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
