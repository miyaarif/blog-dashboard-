"use client";

import { useEffect, useRef, useState } from "react";

// Animates from 0 to `target` via requestAnimationFrame with an ease-out
// cubic curve. Returns a plain number -- format it (toLocaleString, etc.)
// at render time, not here, so the caller controls formatting.
export function useCountUp(
  target: number,
  { durationMs = 700, startWhen = true }: { durationMs?: number; startWhen?: boolean } = {},
): number {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startWhen || startedRef.current) return;
    startedRef.current = true;

    if (target <= 0) {
      setValue(target);
      return;
    }

    const startTime = performance.now();
    let rafId: number;

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [startWhen, target, durationMs]);

  return value;
}
