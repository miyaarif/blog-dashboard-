// Mouse-tracked tooltips are centered on the cursor via a -translate-x-1/2
// transform. Left unclamped, hovering near either edge of a narrow
// container (any phone, most tablets in portrait) pushes half the tooltip
// past the edge — this clamps the anchor so the tooltip's own half-width
// never crosses the container bounds, while still tracking the cursor
// everywhere else.
export function clampTooltipX(
  x: number,
  tooltipWidth: number,
  containerWidth: number,
): number {
  const half = tooltipWidth / 2;
  if (containerWidth <= tooltipWidth) return containerWidth / 2;
  return Math.min(Math.max(x, half), containerWidth - half);
}
