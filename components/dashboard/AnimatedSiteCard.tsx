"use client";

import { useState } from "react";
import Link from "next/link";
import type { Site } from "@/types";
import SiteBadge from "@/components/SiteBadge";
import { ChevronDownIcon } from "@/components/icons";
import { useEntranceReveal } from "./useEntranceReveal";
import { useCountUp } from "./useCountUp";
import { useTypedText } from "./useTypedText";
import { Sparkline } from "./Sparkline";
import { MiniBarBreakdown } from "./MiniBarBreakdown";

interface AnimatedSiteCardProps {
  site: Site;
  index: number; // position in the page's overall stagger sequence
  articleCount: number;
  publishedCount: number;
  trafficSessions: number;
  onTarget: boolean;
  insight: string; // real, pre-computed by the caller
  statusBreakdown: { label: string; value: number; color: string }[]; // real, per-status counts for this site
  weeklyTrend: number[]; // real, this site's publishedPerWeekBySite counts
}

export default function AnimatedSiteCard({
  site,
  index,
  articleCount,
  publishedCount,
  trafficSessions,
  onTarget,
  insight,
  statusBreakdown,
  weeklyTrend,
}: AnimatedSiteCardProps) {
  const { visible, revealed } = useEntranceReveal(index * 100);
  const count = useCountUp(articleCount, { startWhen: revealed });
  const { typed, done: typedDone } = useTypedText(insight, { startWhen: revealed });
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="min-h-full"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
      }}
    >
      {/*
        Real behavior change, required by the spec: this card is no longer
        a whole-card <Link> to /sites/{id} -- clicking the card now toggles
        the expand panel, and only the "View site" text (its own nested
        Link below, stopping propagation) navigates. Keyboard-accessible
        via role="button"/tabIndex/onKeyDown since a div can't be an <a>
        here without breaking that separation.
      */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        aria-expanded={expanded}
        className="group min-h-full rounded-xl border border-line bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <SiteBadge site={site} />
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                onTarget
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
              }`}
            >
              {onTarget ? "On target" : "Behind target"}
            </span>
            <ChevronDownIcon
              className="h-4 w-4 text-muted transition-transform duration-300"
              style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </div>
        </div>

        <div className="mt-4 text-3xl font-semibold text-ink">
          {count.toLocaleString()}
          <span className="ml-1.5 text-sm font-normal text-muted">articles</span>
        </div>
        <div className="mt-1 text-sm text-muted">
          {publishedCount} published &middot; {trafficSessions} sessions / 30d
        </div>

        <p className="mt-2 text-xs text-muted min-h-[1em]">
          {typed}
          {!typedDone && typed.length > 0 && <span className="site-caret" />}
        </p>

        <div
          className="overflow-hidden"
          style={{
            maxHeight: expanded ? 160 : 0,
            opacity: expanded ? 1 : 0,
            transition: "max-height 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease",
          }}
        >
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-xs font-medium text-muted">Status breakdown</p>
            <MiniBarBreakdown items={statusBreakdown} draw={expanded} height={36} />

            {weeklyTrend.some((v) => v > 0) && (
              <>
                <p className="mt-3 text-xs font-medium text-muted">Weekly published trend</p>
                <Sparkline values={weeklyTrend} draw={expanded} color="var(--color-accent)" height={28} />
              </>
            )}
          </div>
        </div>

        <div
          className="mt-4 flex items-center gap-1 text-sm font-medium text-muted group-hover:text-accent"
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/sites/${site.id}`} className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            View site
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .site-caret {
          display: inline-block;
          width: 1px;
          height: 0.85em;
          margin-left: 1px;
          background: currentColor;
          vertical-align: text-bottom;
          animation: site-caret-blink 1s step-start infinite;
        }
        @keyframes site-caret-blink {
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
