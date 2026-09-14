"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  STATUS_ORDER,
  countsByStatusPerSite,
  publishedPerWeek,
  publishedPerWeekBySite,
} from "@/lib/dashboardStats";
import { clampTooltipX } from "@/lib/tooltipPosition";
import type { Article, Site } from "@/types";
import type { StatusBySite, WeeklyPublishCount } from "@/lib/dashboardStats";
import { useSpotlightPlayer, type SpotlightSlide } from "@/components/spotlight/useSpotlightPlayer";
import { SpotlightSidePanel } from "@/components/spotlight/SpotlightSidePanel";
import { SitePicker } from "@/components/spotlight/SitePicker";

// Validated categorical palette (dataviz skill, references/palette.md) —
// first 3 slots pass all-pairs CVD checks, safe for adjacent grouped bars.
const SITE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];
const TOOLTIP_MAX_WIDTH = 220;

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

// Real, computed report text for a site's spotlight slides -- every line
// is derived directly from real counts, no invented commentary.
interface StatusSlideMeta {
  status: string;
  count: number;
}

function buildSiteStatusSlides(
  counts: Record<string, number>,
  siteName: string,
): { slides: SpotlightSlide[]; meta: StatusSlideMeta[] } {
  const slides: SpotlightSlide[] = [];
  const meta: StatusSlideMeta[] = [];
  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
  const maxCount = Math.max(0, ...Object.values(counts));

  for (const status of STATUS_ORDER) {
    const count = counts[status] ?? 0;
    if (count === 0) continue;

    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const lines = [
      `${count} article${count === 1 ? "" : "s"} currently in ${STATUS_LABELS[status].toLowerCase()}.`,
    ];
    if (total > 0) {
      lines.push(`That's ${pct}% of ${siteName}'s ${total} articles in the pipeline.`);
    }
    if (count === maxCount) {
      lines.push("The largest single stage in their pipeline right now.");
    }

    slides.push({
      key: status,
      title: `${STATUS_LABELS[status]} — ${siteName}`,
      bodyText: lines.join("\n"),
    });
    meta.push({ status, count });
  }

  return { slides, meta };
}

function buildWeeklySlides(
  weeks: WeeklyPublishCount[],
  rangeLabelOf: (weekStart: string) => string,
): SpotlightSlide[] {
  const maxCount = Math.max(0, ...weeks.map((w) => w.count));

  return weeks.map((w, i) => {
    const prevCount = i > 0 ? weeks[i - 1].count : null;
    const lines: string[] = [];

    if (w.count === 0) {
      lines.push("No articles published this week.");
    } else {
      lines.push(
        `${w.count} article${w.count === 1 ? "" : "s"} published this week.`,
      );
      if (prevCount !== null) {
        const delta = w.count - prevCount;
        if (delta > 0) lines.push(`That's ${delta} more than the week before.`);
        else if (delta < 0)
          lines.push(`That's ${Math.abs(delta)} fewer than the week before.`);
        else lines.push("Same as the week before.");
      }
      if (w.count === maxCount && maxCount > 0) {
        lines.push("The busiest week in this window.");
      }
    }

    return {
      key: w.weekStart,
      title: `Week of ${rangeLabelOf(w.weekStart)}`,
      bodyText: lines.join("\n"),
    };
  });
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
      className="pointer-events-none absolute z-10 max-w-[220px] -translate-x-1/2 -translate-y-full rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900 shadow-lg transition-[left,top] duration-100 ease-out"
      style={{ left: tooltip.x, top: tooltip.y - 10 }}
    >
      {tooltip.lines.map((line, i) => (
        <div key={i} className={i === 0 ? "font-semibold" : "text-gray-300 dark:text-gray-600"}>
          {line}
        </div>
      ))}
      <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
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
      data-clickable={onClick ? "true" : "false"}
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

// Shared row wrapper: title/subtitle header, then a body area that lays
// the chart out beside the site-picker/info-panel once expanded. Both
// charts use this so the hover-driven layout logic lives in one place.
function ChartFrame({
  title,
  subtitle,
  expanded,
  compact,
  onMouseEnter,
  onMouseLeave,
  chart,
  sidePanel,
}: {
  title: string;
  subtitle: string;
  expanded: boolean;
  compact: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  chart: React.ReactNode;
  sidePanel: React.ReactNode | null;
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`rounded-lg border p-5 transition-colors duration-300 ${
        expanded ? "border-accent bg-card" : "border-line bg-card"
      } ${compact ? "opacity-70" : "opacity-100"}`}
      style={{ transition: "opacity 300ms ease, border-color 300ms ease" }}
    >
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      <div className="mt-3 flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-1">{chart}</div>
        {sidePanel}
      </div>
    </div>
  );
}

function StatusBySiteChart({
  sites,
  articles,
  expanded,
  compact,
  onMouseEnter,
  onMouseLeave,
}: {
  sites: Site[];
  articles: Article[];
  expanded: boolean;
  compact: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useMountedAfterPaint();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const [pickedSiteId, setPickedSiteId] = useState<string | null>(null);

  const bySite = countsByStatusPerSite(articles);
  const siteOrder = sites.filter((s) => bySite.some((b) => b.siteId === s.id));

  // Reset the site pick whenever this chart stops being the expanded one,
  // so hovering away always returns to a clean "ask again" state.
  useEffect(() => {
    if (!expanded) setPickedSiteId(null);
  }, [expanded]);

  const pickedSite = pickedSiteId
    ? siteOrder.find((s) => s.id === pickedSiteId) ?? null
    : null;
  const pickedCounts = pickedSite
    ? bySite.find((b) => b.siteId === pickedSite.id)?.counts ?? null
    : null;

  const { slides, meta: slideMeta } = pickedSite && pickedCounts
    ? buildSiteStatusSlides(pickedCounts, pickedSite.name)
    : { slides: [] as SpotlightSlide[], meta: [] as StatusSlideMeta[] };

  const spotlight = useSpotlightPlayer(slides);

  // "Hover alone does everything" -- the moment a site is picked, start
  // the auto-cycle immediately, no separate play action needed.
  useEffect(() => {
    if (pickedSiteId && slides.length > 0) {
      spotlight.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedSiteId]);

  // Real bug found on re-review: guard against a stale, out-of-bounds
  // currentIndex reading past the end of a *new*, shorter slide set --
  // e.g. pinned at slide 3 on a site with 6 slides, switch to a site with
  // only 2. slides/meta recompute for the new site in the same render,
  // but spotlight.currentIndex only resets via the useEffect above, which
  // runs after this render commits. slideMeta[staleIndex] returns
  // undefined for one render; `!== null` alone would treat that as a
  // real slide and crash on .status. `?? null` closes that gap.
  const activeSlide =
    spotlight.isOpen && slides.length > 0
      ? (slideMeta[spotlight.currentIndex] ?? null)
      : null;

  const maxCount = niceMax(
    Math.max(
      1,
      ...(pickedCounts ? Object.values(pickedCounts) : bySite.flatMap((b) => Object.values(b.counts))),
    ),
  );

  const width = 640;
  const height = compact ? 150 : expanded ? 340 : 280;
  const padLeft = 34;
  const padRight = 8;
  const padTop = 10;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baseline = padTop + plotH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxCount * f));

  function showTooltip(e: React.MouseEvent, lines: string[]) {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const rawX = e.clientX - box.left;
    setTooltip({
      x: clampTooltipX(rawX, TOOLTIP_MAX_WIDTH, box.width),
      y: e.clientY - box.top,
      lines,
    });
  }

  function toggleSite(siteId: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  }

  const groupW = plotW / STATUS_ORDER.length;
  const barW = 10;
  const barGap = 5;
  const groupContentW = siteOrder.length * barW + (siteOrder.length - 1) * barGap;

  const singleBarW = 28;

  return (
    <ChartFrame
      title="Pipeline by status"
      subtitle={
        pickedSite
          ? `${pickedSite.name} — hover away to see all sites again`
          : "Articles per status, by site — hover to see one site's story"
      }
      expanded={expanded}
      compact={compact}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      chart={
        <div ref={containerRef} className="relative">
          <ChartTooltip tooltip={tooltip} />
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            role="img"
            aria-label="Bar chart of article counts by status"
          >
            {yTicks.map((t) => {
              const y = baseline - (t / maxCount) * plotH;
              return (
                <g key={t}>
                  <line x1={padLeft} x2={width - padRight} y1={y} y2={y} className="stroke-line" strokeWidth={1} opacity={0.6} />
                  <text x={padLeft - 6} y={y} textAnchor="end" dominantBaseline="middle" className="fill-chart-label" fontSize={12}>
                    {t}
                  </text>
                </g>
              );
            })}
            <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} className="stroke-line" strokeWidth={1} opacity={0.7} />

            {pickedSite && pickedCounts
              ? // Single-site view: one plain bar per status.
                STATUS_ORDER.map((status, gi) => {
                  const groupX = padLeft + gi * groupW;
                  const x = groupX + (groupW - singleBarW) / 2;
                  const count = pickedCounts[status] ?? 0;
                  const barTop = baseline - (count / maxCount) * plotH;
                  const isActive = activeSlide !== null && activeSlide.status === status;
                  const dimmed = activeSlide !== null && !isActive;
                  const slideIndex = slideMeta.findIndex((m) => m.status === status);
                  return (
                    <g key={status}>
                      <AnimatedBar
                        d={barPath(x, barTop, singleBarW, baseline, 4)}
                        fill={SITE_COLORS[siteOrder.findIndex((s) => s.id === pickedSite.id) % SITE_COLORS.length]}
                        mounted={mounted}
                        delayMs={gi * 15}
                        opacity={dimmed ? 0.25 : 1}
                        onEnter={(e) => showTooltip(e, [STATUS_LABELS[status], `${count} articles`])}
                        onMove={(e) => showTooltip(e, [STATUS_LABELS[status], `${count} articles`])}
                        onLeave={() => setTooltip(null)}
                        onClick={count > 0 && slideIndex >= 0 ? () => spotlight.pin(slideIndex) : undefined}
                      />
                      <text x={groupX + groupW / 2} y={baseline + 16} textAnchor="middle" className="fill-chart-label" fontSize={12}>
                        {STATUS_LABELS[status]}
                      </text>
                    </g>
                  );
                })
              : // Default view: grouped by site.
                STATUS_ORDER.map((status, gi) => {
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
                            onEnter={(e) => showTooltip(e, [`${site.name}`, `${STATUS_LABELS[status]}: ${count}`, ...(count > 0 ? ["Hover the chart, then pick this site"] : [])])}
                            onMove={(e) => showTooltip(e, [`${site.name}`, `${STATUS_LABELS[status]}: ${count}`, ...(count > 0 ? ["Hover the chart, then pick this site"] : [])])}
                            onLeave={() => setTooltip(null)}
                            onClick={count > 0 ? () => router.push(`/articles?site=${site.id}&status=${status}`) : undefined}
                          />
                        );
                      })}
                      <text x={groupX + groupW / 2} y={baseline + 16} textAnchor="middle" className="fill-chart-label" fontSize={12}>
                        {STATUS_LABELS[status]}
                      </text>
                    </g>
                  );
                })}
          </svg>

          {!pickedSite && (
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
                    className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs transition-colors hover:bg-accent-soft"
                    aria-pressed={!isHidden}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm transition-opacity"
                      style={{ backgroundColor: SITE_COLORS[si % SITE_COLORS.length], opacity: isHidden ? 0.25 : 1 }}
                    />
                    <span className={isHidden ? "text-muted line-through" : "text-muted"}>{site.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      }
      sidePanel={
        expanded ? (
          pickedSite ? (
            <SpotlightSidePanel
              title={slides[spotlight.currentIndex]?.title ?? ""}
              typedText={spotlight.typedText}
              isTypingDone={spotlight.isTypingDone}
              isPinned={spotlight.isPinned}
              onResume={spotlight.resume}
              actionLabel={activeSlide ? "View these articles" : undefined}
              onAction={
                activeSlide
                  ? () => router.push(`/articles?site=${pickedSite.id}&status=${activeSlide.status}`)
                  : undefined
              }
              onChangeSite={() => setPickedSiteId(null)}
            />
          ) : (
            <SitePicker sites={siteOrder} onPick={(id) => setPickedSiteId(id)} />
          )
        ) : null
      }
    />
  );
}

function weekEndOf(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

// Shared by the chart's own axis/tooltip labels and the spotlight slide
// titles, so both always say exactly the same thing about a given week.
function rangeLabelOf(weekStart: string): string {
  const label = new Date(weekStart + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const weekEnd = weekEndOf(weekStart);
  const endLabel = new Date(weekEnd + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${label}–${endLabel}`;
}

function WeeklyPublishedChart({
  sites,
  articles,
  expanded,
  compact,
  onMouseEnter,
  onMouseLeave,
}: {
  sites: Site[];
  articles: Article[];
  expanded: boolean;
  compact: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mounted = useMountedAfterPaint();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [pickedSiteId, setPickedSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) setPickedSiteId(null);
  }, [expanded]);

  const pickedSite = pickedSiteId ? sites.find((s) => s.id === pickedSiteId) ?? null : null;

  const weeks = pickedSite
    ? publishedPerWeekBySite(articles, pickedSite.id)
    : publishedPerWeek(articles);

  const slides = buildWeeklySlides(weeks, rangeLabelOf);
  const spotlight = useSpotlightPlayer(slides);

  useEffect(() => {
    if (pickedSiteId && slides.length > 0) {
      spotlight.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedSiteId]);

  // Same stale-index guard as StatusBySiteChart's activeSlide -- switching
  // from a site/network view with more weeks to one with fewer can read
  // weeks[staleIndex] as undefined for one render.
  const activeWeek =
    spotlight.isOpen && weeks.length > 0 ? (weeks[spotlight.currentIndex] ?? null) : null;

  if (weeks.length === 0) {
    return (
      <ChartFrame
        title="Articles published per week"
        subtitle={pickedSite ? `${pickedSite.name} — no published articles yet` : "Whole network, by publish date"}
        expanded={expanded}
        compact={compact}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        chart={<p className="py-6 text-center text-sm text-muted">No published articles yet.</p>}
        sidePanel={expanded && !pickedSite ? <SitePicker sites={sites} onPick={(id) => setPickedSiteId(id)} /> : null}
      />
    );
  }

  const maxCount = niceMax(Math.max(1, ...weeks.map((w) => w.count)));

  const width = 640;
  const height = compact ? 120 : expanded ? 300 : 220;
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
  const labelEvery = Math.ceil(weeks.length / 8);

  function showTooltip(e: React.MouseEvent, lines: string[]) {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    const rawX = e.clientX - box.left;
    setTooltip({ x: clampTooltipX(rawX, TOOLTIP_MAX_WIDTH, box.width), y: e.clientY - box.top, lines });
  }

  return (
    <ChartFrame
      title="Articles published per week"
      subtitle={
        pickedSite
          ? `${pickedSite.name} — hover away to see the whole network again`
          : "Whole network, by publish date — hover to see one site's story"
      }
      expanded={expanded}
      compact={compact}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      chart={
        <div ref={containerRef} className="relative">
          <ChartTooltip tooltip={tooltip} />
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full text-accent" role="img" aria-label="Bar chart of articles published per week">
            {yTicks.map((t) => {
              const y = baseline - (t / maxCount) * plotH;
              return (
                <g key={t}>
                  <line x1={padLeft} x2={width - padRight} y1={y} y2={y} className="stroke-line" strokeWidth={1} opacity={0.6} />
                  <text x={padLeft - 6} y={y} textAnchor="end" dominantBaseline="middle" className="fill-chart-label" fontSize={12}>
                    {t}
                  </text>
                </g>
              );
            })}
            <line x1={padLeft} x2={width - padRight} y1={baseline} y2={baseline} className="stroke-line" strokeWidth={1} opacity={0.7} />

            {weeks.map((w, i) => {
              const slotX = padLeft + i * slotW;
              const x = slotX + (slotW - barW) / 2;
              const barTop = baseline - (w.count / maxCount) * plotH;
              const showLabel = i % labelEvery === 0;
              const label = new Date(w.weekStart + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
              const rangeLabel = rangeLabelOf(w.weekStart);
              const isActive = activeWeek !== null && activeWeek.weekStart === w.weekStart;
              const dimmed = activeWeek !== null && !isActive;
              return (
                <g key={w.weekStart}>
                  <AnimatedBar
                    d={barPath(x, barTop, barW, baseline, 4)}
                    fill="currentColor"
                    mounted={mounted}
                    delayMs={i * 10}
                    opacity={dimmed ? 0.25 : 1}
                    onEnter={(e) => showTooltip(e, [`Week of ${rangeLabel}`, `${w.count} published`])}
                    onMove={(e) => showTooltip(e, [`Week of ${rangeLabel}`, `${w.count} published`])}
                    onLeave={() => setTooltip(null)}
                    onClick={w.count > 0 ? () => spotlight.pin(i) : undefined}
                  />
                  {showLabel && (
                    <text x={slotX + slotW / 2} y={baseline + 14} textAnchor="middle" className="fill-chart-label" fontSize={11}>
                      {label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      }
      sidePanel={
        expanded ? (
          pickedSite ? (
            <SpotlightSidePanel
              title={slides[spotlight.currentIndex]?.title ?? ""}
              typedText={spotlight.typedText}
              isTypingDone={spotlight.isTypingDone}
              isPinned={spotlight.isPinned}
              onResume={spotlight.resume}
              actionLabel={activeWeek && activeWeek.count > 0 ? "View these articles" : undefined}
              onAction={
                activeWeek && activeWeek.count > 0
                  ? () => router.push(`/articles?site=${pickedSite.id}&from=${activeWeek.weekStart}&to=${weekEndOf(activeWeek.weekStart)}`)
                  : undefined
              }
              onChangeSite={() => setPickedSiteId(null)}
            />
          ) : (
            <SitePicker sites={sites} onPick={(id) => setPickedSiteId(id)} />
          )
        ) : null
      }
    />
  );
}

export default function DashboardCharts({
  sites,
  articles,
}: {
  sites: Site[];
  articles: Article[];
}) {
  const [hovered, setHovered] = useState<"status" | "weekly" | null>(null);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <StatusBySiteChart
        sites={sites}
        articles={articles}
        expanded={hovered === "status"}
        compact={hovered === "weekly"}
        onMouseEnter={() => setHovered("status")}
        onMouseLeave={() => setHovered((h) => (h === "status" ? null : h))}
      />
      <WeeklyPublishedChart
        sites={sites}
        articles={articles}
        expanded={hovered === "weekly"}
        compact={hovered === "status"}
        onMouseEnter={() => setHovered("weekly")}
        onMouseLeave={() => setHovered((h) => (h === "weekly" ? null : h))}
      />
    </div>
  );
}
