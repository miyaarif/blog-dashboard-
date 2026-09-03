import { Site, isFinanceSite } from "@/types";

export default function SiteBadge({ site }: { site: Site }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-ink">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: site.primary_colour }}
      />
      {site.name}
      {isFinanceSite(site) && (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          Finance
        </span>
      )}
    </span>
  );
}
