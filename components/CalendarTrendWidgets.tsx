"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { WeeklyPublishCount } from "@/lib/dashboardStats";
import type { WeeklyCollisionCount } from "@/lib/calendarStats";
import { clampTooltipX } from "@/lib/tooltipPosition";

const TOOLTIP_MAX_WIDTH = 180;

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

function AreaChart({
  weeks,
  color,
  noun,
}: {
  weeks: Week[];
  color: string;
  noun: string;
}) {
  const gradientId = useId();
  const pathRef = useRef<SVGPolylineElement>(null);
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

  const linePoints = weeks.map((w, i) => `${xAt(i)},${yAt(w.count)}`).join(" ");
  const areaPoints =
    n > 0
      ? `${padLeft},${padTop + plotH} ${linePoints} ${xAt(n - 1)},${padTop + plotH}`
      : "";

  // Draw-in animation: measure the real path length once mounted, then
  // animate stroke-dashoffset from full length to 0 (the classic SVG
  // "line drawing itself" technique) instead of a plain fade.
  useEffect(() => {
    const el = pathRef.current;
    if (!el || n < 2) return;
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
  }, [n, weeks]);

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
    return <p className="mt-6 text-center text-xs text-gray-400">No data yet.</p>;
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
          className="pointer-events-none absolute z-10 max-w-[180px] -translate-x-1/2 -translate-y-full rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: tooltipLeft, top: tooltipTop - 8 }}
        >
          <div className="font-semibold">Week of {formatWeekRange(hovered.weekStart)}</div>
          <div className="text-gray-300">
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
              stroke="#e1e0d9"
              strokeWidth={1}
              opacity={0.6}
            />
            <text
              x={padLeft - 6}
              y={yAt(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-gray-400"
              fontSize={9}
            >
              {t}
            </text>
          </g>
        ))}

        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
        <polyline
          ref={pathRef}
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
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

function TrendCard({
  label,
  noun,
  weeks,
  color,
}: {
  label: string;
  noun: string;
  weeks: Week[];
  color: string;
}) {
  const current = weeks.length > 0 ? weeks[weeks.length - 1].count : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{current}</p>
      <p className="text-xs text-gray-500">this week &middot; hover the line for detail</p>
      <AreaChart weeks={weeks} color={color} noun={noun} />
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
      <TrendCard label="Published" noun="published" weeks={publishedWeeks} color={GOLD} />
      <TrendCard label="Collisions" noun="collisions" weeks={collisionWeeks} color={ROSE} />
    </div>
  );
}
