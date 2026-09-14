"use client";

import { useState } from "react";
import Link from "next/link";
import { useEntranceReveal } from "./useEntranceReveal";
import { useCountUp } from "./useCountUp";
import { useTypedText } from "./useTypedText";
import { Sparkline } from "./Sparkline";
import { MiniBarBreakdown } from "./MiniBarBreakdown";

interface AnimatedStatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  href: string;
  index: number; // position in the page's overall stagger sequence
  insight: string; // real, pre-computed by the caller -- not hardcoded here
  sparkline:
    | { kind: "line"; values: number[] } // real daily series
    | { kind: "bars"; items: { label: string; value: number; color: string }[] }; // real snapshot breakdown, used where no daily series exists
}

export default function AnimatedStatCard({
  icon,
  label,
  value,
  sub,
  href,
  index,
  insight,
  sparkline,
}: AnimatedStatCardProps) {
  const { visible, revealed } = useEntranceReveal(index * 100);
  const count = useCountUp(value, { startWhen: revealed });
  const { typed, done: typedDone } = useTypedText(insight, { startWhen: revealed });
  const [hovering, setHovering] = useState(false);

  return (
    <div
      className="min-h-full"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
      }}
    >
      <Link
        href={href}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="group rounded-xl border border-line bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md block min-h-full"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
            {icon}
          </div>
          <span
            aria-hidden
            className="text-muted opacity-0 transition-opacity group-hover:opacity-100"
          >
            →
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{count.toLocaleString()}</p>
        <p className="mt-0.5 text-xs text-muted">{sub}</p>

        <p className="mt-2 text-xs text-muted min-h-[1em]">
          {typed}
          {!typedDone && typed.length > 0 && <span className="stat-caret" />}
        </p>
        <style jsx>{`
          .stat-caret {
            display: inline-block;
            width: 1px;
            height: 0.85em;
            margin-left: 1px;
            background: currentColor;
            vertical-align: text-bottom;
            animation: stat-caret-blink 1s step-start infinite;
          }
          @keyframes stat-caret-blink {
            50% {
              opacity: 0;
            }
          }
        `}</style>

        <div
          className="mt-1 overflow-hidden"
          style={{
            maxHeight: hovering ? 36 : 0,
            opacity: hovering ? 1 : 0,
            transition: "max-height 0.3s ease, opacity 0.3s ease",
          }}
        >
          {sparkline.kind === "line" ? (
            <Sparkline values={sparkline.values} draw={hovering} color="var(--color-accent)" />
          ) : (
            <MiniBarBreakdown items={sparkline.items} draw={hovering} />
          )}
        </div>
      </Link>
    </div>
  );
}
