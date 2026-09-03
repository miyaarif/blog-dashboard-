"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { publishedPerWeek } from "@/lib/dashboardStats";
import { collisionsPerWeek } from "@/lib/calendarStats";
import { clampTooltipX } from "@/lib/tooltipPosition";
import type { Article } from "@/types";

const TOOLTIP_MAX_WIDTH = 180;

interface PeriodOption {
  label: string;
  months: number | null; // null = all time
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: "Last 3 months", months: 3 },
  { label: "Last 6 months", months: 6 },
  { label: "Last 12 months", months: 12 },
  { label: "All time", months: null },
];

// Real cutoff date, not a guess — filters real articles by whichever date
// field the caller cares about, so "Last 3 months" means the real last 3
// months relative to today, every time this renders.
function cutoffDate(months: number | null): Date | null {
  if (months === null) return null;
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

// Palette.md categorical slots 4 (yellow/gold) and 5 (magenta/rose) — both
// documented, both flagged sub-3:1 on a light surface, so neither widget
// relies on the line color alone: the count is always shown as plain text.
const GOLD = "#eda100";
const ROSE = "#e87ba4";

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const step = value <= 20 ? 5 : value <= 50 ? 10 : 20;
  return Math.ceil(value / step) * step;
}

function formatWeekLabel(weekStart: string): string {
  return new Date(weekStart + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// The week's Monday itself often has zero activity — the count is spread
// across the other 6 days. Showing only the start date reads as "this
// should be on the 8th"; the full range makes clear it's a 7-day span.
function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const startLabel = formatWeekLabel(weekStart);
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startLabel}–${endLabel}`;
}

interface Week {
  weekStart: string;
  count: number;
}

// Catmull-Rom -> cubic Bezier (tension 1/6) — the standard way to draw a
// smooth curve through a set of points, rather than the straight-segment
// polyline the Published chart still uses.
function smoothPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function straightPathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

function AreaChart({
  weeks,
  color,
  noun,
  smooth = false,
  dashed = false,
  showArea = true,
}: {
  weeks: Week[];
  color: string;
  noun: string;
  smooth?: boolean;
  dashed?: boolean;
  showArea?: boolean;
}) {
  const gradientId = useId();
  const pathRef = useRef<SVGPathElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // The SVG scales to the container's real rendered width via its viewBox,
  // so mouse coordinates (real screen pixels) and chart coordinates (fixed
  // viewBox units) are two different scales — this tracks the real width so
  // both directions can be converted correctly instead of assuming they match.
  const [renderedWidth, setRenderedWidth] = useState<number | null>(null);

  const width = 280;
  const height = 96;
  const padLeft = 22;
  const padRight = 6;
  const padTop = 8;
  const padBottom = 6;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const n = weeks.length;
  const max = niceMax(Math.max(1, ...weeks.map((w) => w.count)));

  function xAt(i: number): number {
    return n <= 1 ? padLeft : padLeft + (i / (n - 1)) * plotW;
  }
  function yAt(v: number): number {
    return padTop + plotH - (v / max) * plotH;
  }

  const points = weeks.map((w, i) => ({ x: xAt(i), y: yAt(w.count) }));
  const lineD = smooth ? smoothPathD(points) : straightPathD(points);
  const areaD =
    n > 0
      ? `${lineD} L${xAt(n - 1)},${padTop + plotH} L${padLeft},${padTop + plotH} Z`
      : "";

  // Draw-in animation: measure the real path length once mounted, then
  // animate stroke-dashoffset from full length to 0 (the classic SVG
  // "line drawing itself" technique) instead of a plain fade. Skipped for
  // the dashed variant, which keeps its permanent dash pattern instead —
  // combining a decorative dash with the reveal-dasharray trick fights
  // over the same CSS property.
  useEffect(() => {
    const el = pathRef.current;
    if (!el || n < 2 || dashed) return;
    const length = el.getTotalLength();
    el.style.transition = "none";
    el.style.strokeDasharray = String(length);
    el.style.strokeDashoffset = String(length);
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)";
        el.style.strokeDashoffset = "0";
      });
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, [n, weeks, dashed]);

  function handleMove(e: React.MouseEvent) {
    if (n === 0) return;
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setRenderedWidth(box.width);
    // Convert the real-pixel mouse position into viewBox units before
    // comparing it to plotW (which is in viewBox units, not pixels).
    const scale = width / box.width;
    const relX = (e.clientX - box.left) * scale - padLeft;
    const idx = Math.round((relX / plotW) * (n - 1));
    setHoverIndex(Math.max(0, Math.min(n - 1, idx)));
  }

  const hovered = hoverIndex !== null ? weeks[hoverIndex] : null;
  // Convert the hovered point back from viewBox units to real pixels so the
  // HTML tooltip (positioned outside the scaled SVG) lands in the right spot.
  const pixelScale = (renderedWidth ?? width) / width;
  const tooltipLeft =
    hoverIndex !== null
      ? clampTooltipX(
          xAt(hoverIndex) * pixelScale,
          TOOLTIP_MAX_WIDTH,
          renderedWidth ?? width,
        )
      : 0;
  const tooltipTop = hovered ? yAt(hovered.count) * pixelScale : 0;

  if (n === 0) {
    return <p className="mt-6 text-center text-xs text-muted">No data yet.</p>;
  }

  return (
    <div
      ref={containerRef}
      className="relative mt-2"
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverIndex(null)}
    >
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 max-w-[180px] -translate-x-1/2 -translate-y-full rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
          style={{ left: tooltipLeft, top: tooltipTop - 8 }}
        >
          <div className="font-semibold">Week of {formatWeekRange(hovered.weekStart)}</div>
          <div className="text-gray-300 dark:text-gray-600">
            {hovered.count} {noun}
          </div>
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {[0, max].map((t) => (
          <g key={t}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={yAt(t)}
              y2={yAt(t)}
              className="stroke-line"
              strokeWidth={1}
              opacity={0.6}
            />
            <text
              x={padLeft - 6}
              y={yAt(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted"
              fontSize={9}
            >
              {t}
            </text>
          </g>
        ))}

        {showArea && <path d={areaD} fill={`url(#${gradientId})`} />}
        <path
          ref={pathRef}
          d={lineD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? "6,4" : undefined}
        />

        {hoverIndex !== null && (
          <>
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={padTop}
              y2={padTop + plotH}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="2,2"
              opacity={0.5}
            />
            <circle
              cx={xAt(hoverIndex)}
              cy={yAt(weeks[hoverIndex].count)}
              r={4}
              fill="white"
              stroke={color}
              strokeWidth={2}
            />
          </>
        )}
      </svg>
    </div>
  );
}

function PeriodSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (index: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-md border border-line bg-card px-2 py-1 text-xs font-medium text-ink focus:border-accent focus:outline-none"
    >
      {PERIOD_OPTIONS.map((opt, i) => (
        <option key={opt.label} value={i}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function TrendCard({
  label,
  noun,
  weeks,
  color,
  periodIndex,
  onPeriodChange,
  smooth,
  dashed,
  showArea,
}: {
  label: string;
  noun: string;
  weeks: Week[];
  color: string;
  periodIndex: number;
  onPeriodChange: (index: number) => void;
  smooth?: boolean;
  dashed?: boolean;
  showArea?: boolean;
}) {
  const current = weeks.length > 0 ? weeks[weeks.length - 1].count : 0;

  return (
    <div className="rounded-lg border border-line bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <PeriodSelect value={periodIndex} onChange={onPeriodChange} />
      </div>
      <p className="mt-1 text-2xl font-semibold text-ink">{current}</p>
      <p className="text-xs text-muted">this week &middot; hover the line for detail</p>
      <AreaChart
        weeks={weeks}
        color={color}
        noun={noun}
        smooth={smooth}
        dashed={dashed}
        showArea={showArea}
      />
    </div>
  );
}

export default function CalendarTrendWidgets({ articles }: { articles: Article[] }) {
  const [publishedPeriod, setPublishedPeriod] = useState(1); // default "Last 6 months"
  const [collisionPeriod, setCollisionPeriod] = useState(1);

  const publishedWeeks = useMemo(() => {
    const cutoff = cutoffDate(PERIOD_OPTIONS[publishedPeriod].months);
    const scoped = cutoff
      ? articles.filter((a) => a.published_at && new Date(a.published_at) >= cutoff)
      : articles;
    return publishedPerWeek(scoped);
  }, [articles, publishedPeriod]);

  const collisionWeeks = useMemo(() => {
    const cutoff = cutoffDate(PERIOD_OPTIONS[collisionPeriod].months);
    const scoped = cutoff
      ? articles.filter((a) => {
          const d = a.scheduled_for || a.published_at;
          return d && new Date(d) >= cutoff;
        })
      : articles;
    return collisionsPerWeek(scoped);
  }, [articles, collisionPeriod]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TrendCard
        label="Published"
        noun="published"
        weeks={publishedWeeks}
        color={GOLD}
        periodIndex={publishedPeriod}
        onPeriodChange={setPublishedPeriod}
      />
      <TrendCard
        label="Collisions"
        noun="collisions"
        weeks={collisionWeeks}
        color={ROSE}
        periodIndex={collisionPeriod}
        onPeriodChange={setCollisionPeriod}
        smooth
        dashed
        showArea={false}
      />
    </div>
  );
}
