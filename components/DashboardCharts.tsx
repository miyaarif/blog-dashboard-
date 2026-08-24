import type { SVGProps } from "react";
import {
  STATUS_ORDER,
  countsByStatusPerSite,
  publishedPerWeek,
} from "@/lib/dashboardStats";
import type { Article, Site } from "@/types";

// @types/react's SVGProps omits the standard `title` attribute — it's valid
// SVG/HTML and renders a native hover tooltip, so we cast it in explicitly.
function titleAttr(text: string): SVGProps<SVGPathElement> {
  return { title: text } as SVGProps<SVGPathElement>;
}

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

function StatusBySiteChart({ sites, articles }: { sites: Site[]; articles: Article[] }) {
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
  const barW = 14;
  const barGap = 3;
  const groupContentW = siteOrder.length * barW + (siteOrder.length - 1) * barGap;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxCount * f));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-semibold text-gray-900">Pipeline by status</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Articles per status, by site
      </p>

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
        />

        {STATUS_ORDER.map((status, gi) => {
          const groupX = padLeft + gi * groupW;
          const startX = groupX + (groupW - groupContentW) / 2;
          return (
            <g key={status}>
              {siteOrder.map((site, si) => {
                const b = bySite.find((x) => x.siteId === site.id);
                const count = b?.counts[status] ?? 0;
                const x = startX + si * (barW + barGap);
                const barTop = baseline - (count / maxCount) * plotH;
                return (
                  <path
                    key={site.id}
                    d={barPath(x, barTop, barW, baseline, 4)}
                    fill={SITE_COLORS[si % SITE_COLORS.length]}
                    {...titleAttr(
                      `${site.name} — ${STATUS_LABELS[status]}: ${count}`,
                    )}
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

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {siteOrder.map((site, si) => (
          <div key={site.id} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: SITE_COLORS[si % SITE_COLORS.length] }}
            />
            {site.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyPublishedChart({ articles }: { articles: Article[] }) {
  const weeks = publishedPerWeek(articles);

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
              <path
                d={barPath(x, barTop, barW, baseline, 3)}
                fill={TREND_COLOR}
                {...titleAttr(`Week of ${label}: ${w.count} published`)}
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
