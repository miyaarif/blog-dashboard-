import type { Article } from "@/types";
import { mondayOf } from "@/lib/dashboardStats";

export function groupByDate(articles: Article[]): Record<string, Article[]> {
  const dated = articles.filter((a) => a.scheduled_for || a.published_at);
  const byDate: Record<string, Article[]> = {};
  dated.forEach((a) => {
    const date = (a.scheduled_for || a.published_at)!.split("T")[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(a);
  });
  return byDate;
}

export interface Gap {
  from: string;
  to: string;
  days: number;
}

export function findCollisions(byDate: Record<string, Article[]>): string[] {
  return Object.keys(byDate)
    .filter((d) => byDate[d].length > 1)
    .sort();
}

export function findGaps(byDate: Record<string, Article[]>): Gap[] {
  const sortedDates = Object.keys(byDate).sort();
  const gaps: Gap[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 3) {
      gaps.push({
        from: sortedDates[i - 1],
        to: sortedDates[i],
        days: Math.round(diffDays),
      });
    }
  }
  return gaps;
}

export function gapSeverity(days: number): { label: string; classes: string } {
  if (days >= 14) return { label: "Critical", classes: "bg-red-50 text-red-700" };
  if (days >= 7) return { label: "Warning", classes: "bg-amber-50 text-amber-700" };
  return { label: "Minor", classes: "bg-gray-100 text-gray-600" };
}

export interface WeeklyCollisionCount {
  weekStart: string; // yyyy-mm-dd, Monday of that week
  count: number;
}

// Number of collision DAYS (2+ articles landing on the same date) per week,
// bucketed the same way lib/dashboardStats.ts buckets publish counts.
export function collisionsPerWeek(articles: Article[]): WeeklyCollisionCount[] {
  const byDate = groupByDate(articles);
  const collisionDates = findCollisions(byDate);

  if (collisionDates.length === 0) return [];

  const mondays = collisionDates.map((d) => mondayOf(new Date(d + "T00:00:00Z")));
  const counts = new Map<string, number>();
  for (const monday of mondays) {
    const key = monday.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const earliest = new Date(Math.min(...mondays.map((d) => d.getTime())));
  const latest = new Date(Math.max(...mondays.map((d) => d.getTime())));

  const weeks: WeeklyCollisionCount[] = [];
  const cursor = new Date(earliest);
  while (cursor <= latest) {
    const key = cursor.toISOString().slice(0, 10);
    weeks.push({ weekStart: key, count: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return weeks;
}
