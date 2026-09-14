"use client";

import { useEffect, useState } from "react";

// Staggered entrance timing shared by every animated card on the
// dashboard. `visible` flips (after one rAF, so the browser paints the
// pre-animation state first -- same reasoning as the existing
// useMountedAfterPaint in DashboardCharts.tsx) once this card's stagger
// delay has passed, which is what the CSS transition (opacity/translateY)
// keys off. `revealed` flips `entranceDurationMs` after that -- once the
// entrance transition has actually finished -- which is what gates the
// count-up and typed-insight animations, per the real requirement that
// those start only once the card has finished animating in, not before.
export function useEntranceReveal(
  staggerDelayMs: number,
  entranceDurationMs = 500,
): { visible: boolean; revealed: boolean } {
  const [visible, setVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let staggerTimer: ReturnType<typeof setTimeout>;
    let revealTimer: ReturnType<typeof setTimeout>;
    const rafId = requestAnimationFrame(() => {
      staggerTimer = setTimeout(() => {
        setVisible(true);
        revealTimer = setTimeout(() => setRevealed(true), entranceDurationMs);
      }, staggerDelayMs);
    });
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(staggerTimer);
      clearTimeout(revealTimer);
    };
  }, [staggerDelayMs, entranceDurationMs]);

  return { visible, revealed };
}
