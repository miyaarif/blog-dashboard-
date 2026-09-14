"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// The rest of "Blog Dashboard" after the icon box's own "B" -- animated
// letter by letter, alternating drop-in/rise-in direction by index.
const REMAINING_LETTERS = "log Dashboard".split("");

const FIRST_LETTER_DELAY_MS = 300; // icon box starts the sequence, this starts ~0.3s in
const LETTER_STAGGER_MS = 90;
const BOUNCE_DURATION_MS = 1500;
// Longest-running piece (the last letter) finishes at its own delay + its
// own duration; +100ms buffer so `played` never flips a frame early.
const TOTAL_DURATION_MS =
  FIRST_LETTER_DELAY_MS +
  (REMAINING_LETTERS.length - 1) * LETTER_STAGGER_MS +
  BOUNCE_DURATION_MS +
  100;

// Sidebar logo entrance -- plays once on mount (no loop), matches the
// existing dashboard entrance-animation convention of hand-rolled CSS
// keyframes + styled-jsx (see AnimatedSiteCard.tsx) rather than a UI
// animation library, since none is used anywhere in this codebase.
//
// This component is mounted twice at once (once in the desktop <aside>,
// once in the mobile top bar) and Sidebar.tsx toggles which one is
// visible with Tailwind's `hidden`/`sm:hidden`, not conditional
// rendering. A `display: none` element's CSS animation is paused, not
// stopped -- so the hidden instance would replay its whole bounce from
// frame zero the moment a resize, rotation, or split-view change made it
// visible again. The `played` flag (driven by a plain setTimeout, which
// keeps ticking regardless of display) sidesteps that: once real time
// since mount exceeds the animation's total length, both instances drop
// the animation classes and render already-settled, so crossing that
// breakpoint after the animation window never re-triggers it.
export default function SidebarLogo({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPlayed(true), TOTAL_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Link
      href="/"
      onClick={onClick}
      className={`flex items-center gap-2 text-sm font-semibold text-ink ${className ?? ""}`}
    >
      <span
        className={`sidebar-logo-box flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-white ${
          played ? "" : "sidebar-logo-box--animating"
        }`}
      >
        B
      </span>
      <span className="flex">
        {REMAINING_LETTERS.map((char, i) => (
          <span
            key={i}
            className={`sidebar-logo-letter ${
              played
                ? ""
                : i % 2 === 0
                  ? "sidebar-logo-letter-down"
                  : "sidebar-logo-letter-up"
            }`}
            style={{
              animationDelay: played ? undefined : `${FIRST_LETTER_DELAY_MS + i * LETTER_STAGGER_MS}ms`,
              whiteSpace: char === " " ? "pre" : undefined,
            }}
          >
            {char}
          </span>
        ))}
      </span>

      <style jsx>{`
        .sidebar-logo-box--animating {
          opacity: 0;
          animation: sidebar-logo-bounce-down ${BOUNCE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .sidebar-logo-letter {
          display: inline-block;
        }
        .sidebar-logo-letter-down,
        .sidebar-logo-letter-up {
          opacity: 0;
          animation-duration: ${BOUNCE_DURATION_MS}ms;
          animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
          animation-fill-mode: both;
        }
        .sidebar-logo-letter-down {
          animation-name: sidebar-logo-bounce-down;
        }
        .sidebar-logo-letter-up {
          animation-name: sidebar-logo-bounce-up;
        }

        /* Position-only keyframes at 0/38/52/66/78/88/100% -- two
           diminishing overshoots past rest before settling, rather than a
           single ease-out. Opacity reaches 1 by the first overshoot (38%)
           and holds; only translateY keeps moving after that. */
        @keyframes sidebar-logo-bounce-down {
          0% {
            opacity: 0;
            transform: translateY(-40px);
          }
          38% {
            opacity: 1;
            transform: translateY(8px);
          }
          52% {
            transform: translateY(-4px);
          }
          66% {
            transform: translateY(2px);
          }
          78% {
            transform: translateY(-1px);
          }
          88% {
            transform: translateY(0.5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes sidebar-logo-bounce-up {
          0% {
            opacity: 0;
            transform: translateY(40px);
          }
          38% {
            opacity: 1;
            transform: translateY(-8px);
          }
          52% {
            transform: translateY(4px);
          }
          66% {
            transform: translateY(-2px);
          }
          78% {
            transform: translateY(1px);
          }
          88% {
            transform: translateY(-0.5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sidebar-logo-box--animating,
          .sidebar-logo-letter-down,
          .sidebar-logo-letter-up {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </Link>
  );
}
