import type { WeeklyPublishCount } from "@/lib/dashboardStats";
import type { WeeklyCollisionCount } from "@/lib/calendarStats";

// Palette.md categorical slots 4 (yellow/gold) and 5 (magenta/rose) — both
// documented, both flagged sub-3:1 on a light surface, so neither widget
// relies on the line color alone: the count is always shown as plain text.
const GOLD = "#eda100";
const ROSE = "#e87ba4";

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const width = 160;
  const height = 40;
  const max = Math.max(1, ...points);
  const stepX = width / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 6) - 3;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" aria-hidden="true">
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={height - (points[points.length - 1] / max) * (height - 6) - 3}
        r={3}
        fill={color}
      />
    </svg>
  );
}

function TrendCard({
  label,
  weeks,
  color,
}: {
  label: string;
  weeks: { weekStart: string; count: number }[];
  color: string;
}) {
  const current = weeks.length > 0 ? weeks[weeks.length - 1].count : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{current}</p>
      <p className="text-xs text-gray-500">this week</p>
      <Sparkline points={weeks.map((w) => w.count)} color={color} />
    </div>
  );
}

export default function CalendarTrendWidgets({
  publishedWeeks,
  collisionWeeks,
}: {
  publishedWeeks: WeeklyPublishCount[];
  collisionWeeks: WeeklyCollisionCount[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TrendCard label="Published" weeks={publishedWeeks} color={GOLD} />
      <TrendCard label="Collisions" weeks={collisionWeeks} color={ROSE} />
    </div>
  );
}
