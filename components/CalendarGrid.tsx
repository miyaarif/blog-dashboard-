"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Article, Site } from "@/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Sequential one-hue ramp (dataviz skill, references/palette.md), steps
// spaced widely enough to stay visually distinct at this small badge size.
function countColor(count: number): string {
  if (count >= 3) return "#104281";
  if (count === 2) return "#256abf";
  return "#5598e7";
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

export default function CalendarGrid({
  byDate,
  sites,
}: {
  byDate: Record<string, Article[]>;
  sites: Site[];
}) {
  const sitesById = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  }));

  const todayKey = dateKey(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  }

  const days = monthGrid(cursor.year, cursor.month);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">
          {MONTH_LABELS[cursor.month]} {cursor.year}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setCursor({ year: today.getUTCFullYear(), month: today.getUTCMonth() })
            }
            className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
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

      <div className="mt-4 grid grid-cols-7 gap-1">
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
          const isToday = key === todayKey;

          const tooltip =
            items.length > 0
              ? items
                  .map((a) => {
                    const site = sitesById.get(a.site_id);
                    return `${site ? site.name + ": " : ""}${a.title}`;
                  })
                  .join("\n")
              : undefined;

          const cell = (
            <div
              className={`flex aspect-square flex-col items-center justify-start gap-1 rounded-md p-1 ${
                isToday ? "bg-gray-50 ring-1 ring-inset ring-gray-300" : ""
              }`}
              title={tooltip}
            >
              <span
                className={`text-xs ${
                  inMonth ? "text-gray-700" : "text-gray-300"
                } ${isToday ? "font-semibold text-gray-900" : ""}`}
              >
                {date.getUTCDate()}
              </span>
              {items.length > 0 && (
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium text-white"
                  style={{ backgroundColor: countColor(items.length) }}
                >
                  {items.length}
                </span>
              )}
            </div>
          );

          // A single article that day links straight to it; multiple
          // articles rely on the hover tooltip (a link can only go one place).
          return (
            <div key={key}>
              {items.length === 1 ? (
                <Link href={`/articles/${items[0].id}`} className="block hover:bg-gray-50 rounded-md">
                  {cell}
                </Link>
              ) : (
                cell
              )}
            </div>
          );
        })}
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
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: countColor(3) }}
          />
          3+ articles (collision)
        </span>
      </div>
    </div>
  );
}
