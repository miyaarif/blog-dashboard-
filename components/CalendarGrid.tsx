"use client";

import { useMemo, useState } from "react";
import { caveat } from "@/lib/fonts";
import { groupByDate } from "@/lib/calendarStats";
import CalendarDayPanel from "@/components/CalendarDayPanel";
import HeroImage from "@/components/HeroImage";
import type { Article, Site } from "@/types";

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Sampled by eye from the reference poster, not pixel-picked — flagged as
// an approximation rather than claimed exact.
const BG = "#CFE1F8";
const GREEN_DARK = "#2F6B2A"; // month name, date numbers, primary structure
const GREEN_MID = "#6FA05F"; // grid lines, weekday labels, secondary text

function dateKey(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function monthGrid(year: number, month: number): Date[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const rows = Math.ceil((firstWeekday + daysInMonth) / 7);
  return Array.from(
    { length: rows * 7 },
    (_, i) => new Date(Date.UTC(year, month, 1 - firstWeekday + i)),
  );
}

export default function CalendarGrid({
  articles,
  site,
}: {
  articles: Article[];
  site: Site;
}) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  }));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayKey = dateKey(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  const byDate = useMemo(() => groupByDate(articles), [articles]);
  const days = monthGrid(cursor.year, cursor.month);

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-8"
      style={{ backgroundColor: BG, borderColor: GREEN_MID }}
    >
      <div className="flex items-start justify-between gap-4">
        <h2
          className={`${caveat.className} lowercase leading-none`}
          style={{ color: GREEN_DARK, fontSize: "clamp(40px, 8vw, 72px)" }}
        >
          {MONTH_LABELS[cursor.month]}
        </h2>

        <div className="flex flex-col items-end gap-1.5 pt-1">
          <p className="text-right text-sm font-bold sm:text-base" style={{ color: GREEN_DARK }}>
            {site.name}
            <br />
            publishing schedule {cursor.year}
          </p>
          <div className="flex items-center gap-3 text-lg font-bold" style={{ color: GREEN_DARK }}>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="transition-opacity hover:opacity-60"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() =>
                setCursor({ year: today.getUTCFullYear(), month: today.getUTCMonth() })
              }
              className="text-xs font-bold uppercase tracking-wide transition-opacity hover:opacity-60"
            >
              today
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="transition-opacity hover:opacity-60"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div
        className="mt-6 grid grid-cols-7 border-t border-l"
        style={{ borderColor: GREEN_MID }}
      >
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="border-b border-r px-2 py-2 text-center text-[10px] font-bold tracking-wide sm:text-xs"
            style={{ borderColor: GREEN_MID, color: GREEN_MID }}
          >
            {label}
          </div>
        ))}

        {days.map((date) => {
          const key = date.toISOString().slice(0, 10);
          const inMonth = date.getUTCMonth() === cursor.month;
          const items = byDate[key] ?? [];
          const primary = items[0];
          const extra = items.length - 1;
          const isToday = key === todayKey;

          return (
            <button
              key={key}
              type="button"
              onClick={() => items.length > 0 && setSelectedDate(key)}
              disabled={items.length === 0}
              className="relative flex flex-col items-stretch border-b border-r p-1.5 text-left transition-colors sm:p-2"
              style={{
                borderColor: GREEN_MID,
                aspectRatio: "3 / 4",
                cursor: items.length > 0 ? "pointer" : "default",
                backgroundColor: isToday ? "rgba(255,255,255,0.35)" : undefined,
              }}
            >
              <span
                className="text-[11px] font-bold sm:text-sm"
                style={{ color: inMonth ? GREEN_DARK : GREEN_MID, opacity: inMonth ? 1 : 0.4 }}
              >
                {date.getUTCDate()}
              </span>

              {primary && (
                <div className="relative mt-1 flex min-h-0 flex-1 flex-col gap-1">
                  <div className="relative min-h-0 flex-1 overflow-hidden rounded-md">
                    {/* The hero image bakes its own real title into the
                        bottom of the 1200x630 canvas (lib/heroImage.tsx).
                        This cell's aspect ratio is close to square, so
                        object-cover crops the SIDES, not top/bottom — the
                        full image height stays visible, showing a garbled
                        cropped fragment of that baked-in title (confirmed
                        with a real screenshot; object-position couldn't
                        fix it, since there's no vertical slack to shift).
                        Masking the bottom half with the same dark colour
                        the hero-image template uses hides that text
                        cleanly regardless of exact crop math — the real
                        title is already shown in full below as our own
                        caption, so nothing is lost. */}
                    <HeroImage
                      src={primary.hero_image_url}
                      alt={primary.hero_image_alt ?? ""}
                      className="h-full w-full object-cover"
                      fallbackClassName="h-full w-full bg-white/50"
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
                      style={{ backgroundColor: "#0F172A" }}
                    />
                    {extra > 0 && (
                      <span
                        className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: GREEN_DARK }}
                      >
                        +{extra}
                      </span>
                    )}
                  </div>
                  {/* Hidden below sm: measured the real rendered cell at
                      375px wide — 57px tall total, and the date number plus
                      a 2-line caption alone consumed all of it, squeezing
                      the image to 0px height (confirmed by measuring the
                      real img element, not assumed). The real title is
                      still one tap away via the day panel, so nothing is
                      lost — the image just gets to stay the dominant,
                      visible thing on a small screen. */}
                  <p
                    title={primary.title}
                    className="hidden text-[11px] font-semibold leading-tight sm:line-clamp-2"
                    style={{ color: GREEN_DARK }}
                  >
                    {primary.title}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <CalendarDayPanel
        date={selectedDate}
        articles={selectedDate ? byDate[selectedDate] ?? [] : []}
        sites={[site]}
        onClose={() => setSelectedDate(null)}
      />
    </div>
  );
}
