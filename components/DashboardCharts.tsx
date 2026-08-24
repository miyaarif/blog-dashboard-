"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STATUS_ORDER,
  countsByStatusPerSite,
  publishedPerWeek,
} from "@/lib/dashboardStats";
import type { Article, Site } from "@/types";

// Validated categorical palette (dataviz skill, references/palette.md) —
// first 3 slots pass all-pairs CVD checks, safe for adjacent grouped bars.
const SITE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];
const TREND_COLOR = "#2a78d6";

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  outlined: "Outlined",
  drafted: "Drafted",
  needs_review: "Needs review",
  scheduled: "Scheduled",
  published: "Published",
};

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const step = value <= 20 ? 5 : value <= 50 ? 10 : 20;
  return Math.ceil(value / step) * step;
}

// Path for a bar with rounded top corners and a square baseline.
function barPath(x: number, yTop: number, width: number, yBase: number, radius: number): string {
  const h = yBase - yTop;
  const r = Math.min(radius, width / 2, Math.max(h, 0));
  if (h <= 0) return "";
  if (r <= 0) {
    return `M${x},${yTop} H${x + width} V${yBase} H${x} Z`;
  }
  return [
    `M${x},${yTop + r}`,
    `A${r},${r} 0 0 1 ${x + r},${yTop}`,
    `H${x + width - r}`,
    `A${r},${r} 0 0 1 ${x + width},${yTop + r}`,
    `V${yBase}`,
    `H${x}`,
    `Z`,
  ].join(" ");
}

// Waits two animation frames so the browser paints the collapsed (scaleY:0)
// state before flipping to full height — otherwise the transition is skipped.
function useMountedAfterPaint(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id2);
    });
    return () => cancelAnimationFrame(id1);
  }, []);
  return mounted;
}

interface TooltipState {
  x: number;
  y: number;
  lines: string[];
}

function ChartTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg transition-[left,top] duration-100 ease-out"
      style={{ left: tooltip.x, top: tooltip.y - 10 }}
    >
      {tooltip.lines.map((line, i) => (
        <div key={i} className={i === 0 ? "font-semibold" : "text-gray-300"}>
          {line}
        </div>
      ))}
      <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
    </div>
  );
}

// Animated bar: grows from the baseline on mount, via a fill-box transform
// origin so no per-bar coordinate math is needed for the animation itself.
function AnimatedBar({
  d,
  fill,
  mounted,
  delayMs,
  opacity,
  onEnter,
  onMove,
  onLeave,
  onClick,
}: {
  d: string;
  fill: string;
  mounted: boolean;
  delayMs: number;
  opacity: number;
  onEnter: (e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onLeave: () => void;
  onClick?: () => void;
}) {
  return (
    <path
      d={d}
      fill={fill}
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        transformBox: "fill-box",
        transformOrigin: "bottom",
        transform: mounted ? "scaleY(1)" : "scaleY(0)",
        opacity,
        transition: `transform 0.5s cubic-bezier(0.16,1,0.3,1) ${delayMs}ms, opacity 0.15s ease-out`,
        cursor: onClick ? "pointer" : "default",
      }}
    />
  );
}

function StatusBySiteChart({ sites, articles }: { sites: Site[]; articles: Article[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useMountedAfterPaint();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);

  const bySite = countsByStatusPerSite(articles);
  const siteOrder = sites.filter((s) => bySite.some((b) => b.siteId === s.id));

  const maxCount = niceMax(
    Math.max(1, ...bySite.flatMap((b) => Object.values(b.counts))),
  );

  const width = 640;
  const height = 280;
  const padLeft = 34;
  const padRight = 8;
  const padTop = 10;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baseline = padTop + plotH;

  const groupW = plotW / STATUS_ORDER.length;
  const barW = 10;
  const barGap = 5;
  const groupContentW = siteOrder.length * barW + (siteOrder.length - 1) * barGap;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxCount * f));

  function showTooltip(e: React.MouseEvent, lines: string[]) {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setTooltip({ x: e.clientX - box.left, y: e.clientY - box.top, lines });
  }

  function toggleSite(siteId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-semibold text-gray-900">Pipeline by status</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Articles per status, by site — click a legend item to toggle it
      </p>

      <div ref={containerRef} className="relative">
        <ChartTooltip tooltip={tooltip} />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-3 w-full"
          role="img"
          aria-label="Grouped bar chart of article counts by status and site"
        >
          {yTicks.map((t) => {
            const y = baseline - (t / maxCount) * plotH;
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke="#e1e0d9"
                  strokeWidth={1}
                  opacity={0.6}
                />
                <text
                  x={padLeft - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-gray-400"
                  fontSize={10}
                >
                  {t}
                </text>
              </g>
            );
          })}
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={baseline}
            y2={baseline}
            stroke="#c3c2b7"
            strokeWidth={1}
            opacity={0.7}
          />

          {STATUS_ORDER.map((status, gi) => {
            const groupX = padLeft + gi * groupW;
            const startX = groupX + (groupW - groupContentW) / 2;
            return (
              <g key={status}>
                {siteOrder.map((site, si) => {
                  if (hidden.has(site.id)) return null;
                  const b = bySite.find((x) => x.siteId === site.id);
                  const count = b?.counts[status] ?? 0;
                  const x = startX + si * (barW + barGap);
                  const barTop = baseline - (count / maxCount) * plotH;
                  const dimmed = hoveredSite !== null && hoveredSite !== site.id;
                  return (
                    <AnimatedBar
                      key={site.id}
                      d={barPath(x, barTop, barW, baseline, 4)}
                      fill={SITE_COLORS[si % SITE_COLORS.length]}
                      mounted={mounted}
                      delayMs={(gi * siteOrder.length + si) * 12}
                      opacity={dimmed ? 0.25 : 1}
                      onEnter={(e) =>
                        showTooltip(e, [
                          `${site.name}`,
                          `${STATUS_LABELS[status]}: ${count}`,
                          ...(count > 0 ? ["Click to view articles"] : []),
                        ])
                      }
                      onMove={(e) =>
                        showTooltip(e, [
                          `${site.name}`,
                          `${STATUS_LABELS[status]}: ${count}`,
                          ...(count > 0 ? ["Click to view articles"] : []),
                        ])
                      }
                      onLeave={() => setTooltip(null)}
                      onClick={
                        count > 0
                          ? () =>
                              router.push(
                                `/articles?site=${site.id}&status=${status}`,
                              )
                          : undefined
                      }
                    />
                  );
                })}
                <text
                  x={groupX + groupW / 2}
                  y={baseline + 16}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize={10}
                >
                  {STATUS_LABELS[status]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {siteOrder.map((site, si) => {
          const isHidden = hidden.has(site.id);
          return (
            <button
              key={site.id}
              type="button"
              onClick={() => toggleSite(site.id)}
              onMouseEnter={() => setHoveredSite(site.id)}
              onMouseLeave={() => setHoveredSite(null)}
              className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs transition-colors hover:bg-gray-50"
              aria-pressed={!isHidden}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm transition-opacity"
                style={{
                  backgroundColor: SITE_COLORS[si % SITE_COLORS.length],
                  opacity: isHidden ? 0.25 : 1,
                }}
              />
              <span
                className={
                  isHidden ? "text-gray-400 line-through" : "text-gray-600"
                }
              >
                {site.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function weekEndOf(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function WeeklyPublishedChart({ articles }: { articles: Article[] }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useMountedAfterPaint();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const weeks = publishedPerWeek(articles);

  function showTooltip(e: React.MouseEvent, lines: string[]) {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setTooltip({ x: e.clientX - box.left, y: e.clientY - box.top, lines });
  }

  if (weeks.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">
          Articles published per week
        </p>
        <p className="mt-6 text-center text-sm text-gray-400">
          No published articles yet.
        </p>
      </div>
    );
  }

  const maxCount = niceMax(Math.max(1, ...weeks.map((w) => w.count)));

  const width = 640;
  const height = 220;
  const padLeft = 28;
  const padRight = 8;
  const padTop = 10;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baseline = padTop + plotH;

  const slotW = plotW / weeks.length;
  const barW = Math.min(20, Math.max(3, slotW - 3));

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxCount * f));

  // label every Nth week so labels don't collide
  const labelEvery = Math.ceil(weeks.length / 8);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-semibold text-gray-900">
        Articles published per week
      </p>
      <p className="mt-0.5 text-xs text-gray-500">Whole network, by publish date</p>

      <div ref={containerRef} className="relative">
        <ChartTooltip tooltip={tooltip} />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-3 w-full"
          role="img"
          aria-label="Bar chart of articles published per week across the network"
        >
          {yTicks.map((t) => {
            const y = baseline - (t / maxCount) * plotH;
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke="#e1e0d9"
                  strokeWidth={1}
                  opacity={0.6}
                />
                <text
                  x={padLeft - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-gray-400"
                  fontSize={10}
                >
                  {t}
                </text>
              </g>
            );
          })}
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={baseline}
            y2={baseline}
            stroke="#c3c2b7"
            strokeWidth={1}
            opacity={0.7}
          />

          {weeks.map((w, i) => {
            const slotX = padLeft + i * slotW;
            const x = slotX + (slotW - barW) / 2;
            const barTop = baseline - (w.count / maxCount) * plotH;
            const showLabel = i % labelEvery === 0;
            const label = new Date(w.weekStart + "T00:00:00Z").toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", timeZone: "UTC" },
            );
            return (
              <g key={w.weekStart}>
                <AnimatedBar
                  d={barPath(x, barTop, barW, baseline, 4)}
                  fill={TREND_COLOR}
                  mounted={mounted}
                  delayMs={i * 10}
                  opacity={1}
                  onEnter={(e) =>
                    showTooltip(e, [
                      `Week of ${label}`,
                      `${w.count} published`,
                      ...(w.count > 0 ? ["Click to view articles"] : []),
                    ])
                  }
                  onMove={(e) =>
                    showTooltip(e, [
                      `Week of ${label}`,
                      `${w.count} published`,
                      ...(w.count > 0 ? ["Click to view articles"] : []),
                    ])
                  }
                  onLeave={() => setTooltip(null)}
                  onClick={
                    w.count > 0
                      ? () =>
                          router.push(
                            `/articles?from=${w.weekStart}&to=${weekEndOf(w.weekStart)}`,
                          )
                      : undefined
                  }
                />
                {showLabel && (
                  <text
                    x={slotX + slotW / 2}
                    y={baseline + 14}
                    textAnchor="middle"
                    className="fill-gray-500"
                    fontSize={9}
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function DashboardCharts({
  sites,
  articles,
}: {
  sites: Site[];
  articles: Article[];
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <StatusBySiteChart sites={sites} articles={articles} />
      <WeeklyPublishedChart articles={articles} />
    </div>
  );
}
