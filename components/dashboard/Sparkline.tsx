"use client";

import { useEffect, useRef, useState } from "react";

// Real line sparkline for a day-bucketed series (e.g. articlesCreatedPerDay).
// Draws in via stroke-dasharray/stroke-dashoffset rather than just
// appearing, per the real requirement. `draw` toggles the animation --
// true to draw in, false snaps it back to hidden (re-triggers on next
// hover rather than staying drawn forever).
export function Sparkline({
  values,
  draw,
  color = "currentColor",
  height = 30,
}: {
  values: number[];
  draw: boolean;
  color?: string;
  height?: number;
}) {
  const width = 120;
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  const max = Math.max(1, ...values);
  const points = values.map((v, i) => {
    const x = values.length > 1 ? (i / (values.length - 1)) * width : 0;
    const y = height - (v / max) * (height - 2) - 1;
    return [x, y] as const;
  });
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  useEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength());
  }, [d]);

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: length || 1,
          strokeDashoffset: draw ? 0 : length || 1,
          transition: "stroke-dashoffset 0.6s ease-out",
        }}
      />
    </svg>
  );
}
