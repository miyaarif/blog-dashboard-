"use client";

import { useEntranceReveal } from "./useEntranceReveal";

// Entrance-only wrapper for anything in the staggered sequence that
// doesn't need count-up/typed-insight/expand behavior (e.g. the "Add
// site" tile) -- wraps existing markup unchanged, adds only the
// fade+slide-up entrance.
export default function EntranceWrapper({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { visible } = useEntranceReveal(index * 100);
  return (
    <div
      className={`min-h-full ${className ?? ""}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
      }}
    >
      {children}
    </div>
  );
}
