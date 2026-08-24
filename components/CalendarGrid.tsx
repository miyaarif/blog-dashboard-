"use client";

import { useMemo, useRef, useState } from "react";
import { AlertIcon, CloseIcon, SearchIcon } from "@/components/icons";
import CalendarDayPanel from "@/components/CalendarDayPanel";
import type { Article, Site } from "@/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Sequential one-hue ramp (dataviz skill, references/palette.md), validated
// with --ordinal — these are the small count-badge colors, kept as-is.
function countColor(count: number): string {
  if (count >= 3) return "#104281";
  if (count === 2) return "#256abf";
  return "#5598e7";
}

// Cell background: light/medium blue washes for 1-2 articles, and the full
// saturated dark navy for 3+ (a collision) — the "!" badge on that dark
// background is the explicit non-color-alone indicator.
function cellBackground(count: number): string | undefined {
  if (count >= 3) return countColor(3);
  if (count === 2) return "rgba(37,106,191,0.18)";
  if (count === 1) return "rgba(85,152,231,0.12)";
  return undefined;
}

function dateKey(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function monthGrid(year: number, month: number): Date[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return Array.from(
    { length: 42 },
    (_, i) => new Date(Date.UTC(year, month, 1 - firstWeekday + i)),
  );
}

interface HoverState {
  key: string;
  x: number;
  y: number;
}

export default function CalendarGrid({
  byDate,
  sites,
}: {
  byDate: Record<string, Article[]>;
  sites: Site[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sitesById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  }));
  const [hover, setHover] = useState<HoverState | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const todayKey = dateKey(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  const query = search.trim().toLowerCase();

  function matchesSearch(key: string): boolean {
    if (!query) return true;
    const items = byDate[key];
    if (!items) return false;
    return items.some((a) => a.title.toLowerCase().includes(query));
  }

  function jumpToNearestMatch() {
    if (!query) return;
    const matchMonths = new Set<string>();
    for (const [key, items] of Object.entries(byDate)) {
      if (items.some((a) => a.title.toLowerCase().includes(query))) {
        const d = new Date(key + "T00:00:00Z");
        matchMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
      }
    }
    if (matchMonths.size === 0) return;

    const currentInMonth = days.some(
      (d) => d.getUTCMonth() === cursor.month && matchesSearch(d.toISOString().slice(0, 10)),
    );
    if (currentInMonth) return;

    let best: { year: number; month: number; dist: number } | null = null;
    for (const key of matchMonths) {
      const [y, m] = key.split("-").map(Number);
      const dist = Math.abs((y - cursor.year) * 12 + (m - cursor.month));
      if (!best || dist < best.dist) best = { year: y, month: m, dist };
    }
    if (best) setCursor({ year: best.year, month: best.month });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
  }

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  }

  const days = monthGrid(cursor.year, cursor.month);

  function showTooltip(e: React.MouseEvent, key: string) {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ key, x: e.clientX - box.left, y: e.clientY - box.top });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-gray-900">
          {MONTH_LABELS[cursor.month]} {cursor.year}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && jumpToNearestMatch()}
              onBlur={jumpToNearestMatch}
              placeholder="Search titles…"
              className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none sm:w-48"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                setCursor({ year: today.getUTCFullYear(), month: today.getUTCMonth() })
              }
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
            >
              Today
            </button>
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              ←
            </button>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative mt-4">
        {hover &&
          (() => {
            const items = byDate[hover.key] ?? [];
            if (items.length === 0) return null;
            return (
              <div
                className="pointer-events-auto absolute z-10 w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
                style={{ left: hover.x, top: hover.y - 10 }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500">
                    {items.length} {items.length === 1 ? "article" : "articles"}
                  </p>
                  <button
                    onClick={() => setHover(null)}
                    aria-label="Close"
                    className="text-gray-300 hover:text-gray-600"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {items.map((a, i) => {
                    const site = sitesById.get(a.site_id);
                    return (
                      <li key={a.id} className="truncate text-xs text-gray-700">
                        {i + 1}. {site ? `${site.name}: ` : ""}
                        {a.title}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400"
            >
              {d}
            </div>
          ))}

          {days.map((date) => {
            const key = date.toISOString().slice(0, 10);
            const inMonth = date.getUTCMonth() === cursor.month;
            const items = byDate[key] ?? [];
            const count = items.length;
            const isToday = key === todayKey;
            const isSelected = key === selectedDate;
            const dimmed = query !== "" && !matchesSearch(key);
            const isDark = count >= 3;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                onMouseEnter={(e) => count > 0 && showTooltip(e, key)}
                onMouseMove={(e) => count > 0 && showTooltip(e, key)}
                onMouseLeave={() => setHover(null)}
                className={`relative flex aspect-square flex-col items-start rounded-md border p-1 text-left transition-all ${
                  isSelected
                    ? "border-blue-500 shadow-[0_0_0_3px_rgba(37,99,235,0.25)]"
                    : isToday
                      ? "border-blue-300"
                      : "border-gray-100 hover:border-gray-200"
                } ${dimmed ? "opacity-30" : ""}`}
                style={{ backgroundColor: cellBackground(count) }}
              >
                <span
                  className={`text-xs ${
                    isDark
                      ? "font-semibold text-white"
                      : inMonth
                        ? "text-gray-700"
                        : "text-gray-300"
                  } ${isToday && !isDark ? "font-semibold text-blue-700" : ""}`}
                >
                  {date.getUTCDate()}
                </span>
                {count > 0 && (
                  <span className="flex flex-1 w-full items-center justify-center">
                    <span
                      className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-white"
                      style={{
                        backgroundColor: isDark ? "rgba(255,255,255,0.2)" : countColor(count),
                      }}
                    >
                      {isDark && <AlertIcon className="h-2.5 w-2.5" />}
                      {count}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: countColor(1) }}
          />
          1 article
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: countColor(2) }}
          />
          2 articles
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="flex h-3 items-center gap-0.5 rounded-full px-1 text-white"
            style={{ backgroundColor: countColor(3) }}
          >
            <AlertIcon className="h-2 w-2" />
          </span>
          3+ articles (collision)
        </span>
      </div>

      <CalendarDayPanel
        date={selectedDate}
        articles={selectedDate ? byDate[selectedDate] ?? [] : []}
        sites={sites}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
