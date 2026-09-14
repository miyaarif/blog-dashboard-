"use client";

// Real per-item breakdown, shown as small bars -- used where a true daily
// time series doesn't exist (e.g. organic_sessions_30d is a single
// rolled-up number per article, with no real day-by-day figure anywhere
// in the schema). This shows a real breakdown of the current snapshot
// instead of fabricating a trend line for data that isn't tracked.
export function MiniBarBreakdown({
  items,
  draw,
  height = 30,
}: {
  items: { label: string; value: number; color: string }[];
  draw: boolean;
  height?: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {items.map((item) => (
        <div
          key={item.label}
          title={`${item.label}: ${item.value}`}
          style={{
            width: 10,
            borderRadius: "2px 2px 0 0",
            backgroundColor: item.color,
            height: draw ? `${Math.max(4, (item.value / max) * 100)}%` : "0%",
            transition: "height 0.5s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      ))}
    </div>
  );
}
