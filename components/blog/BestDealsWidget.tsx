import type { BrandDeal } from "@/app/api/blog/data";

// Real brand data only — logo + discount % + CTA link all present, or the
// whole widget renders nothing. No placeholder/empty state: as of
// 2026-09-03 no brand row has all three, so this returns null everywhere
// in production today. That's expected, not a bug.
export default function BestDealsWidget({ deals }: { deals: BrandDeal[] }) {
  if (deals.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-gray-900">Best deals</div>
      <ul className="space-y-3">
        {deals.map((deal) => (
          <li key={deal.brandId} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={deal.logoUrl}
              alt={deal.brandName}
              className="h-8 w-8 shrink-0 rounded object-contain"
            />
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate font-medium text-gray-900">
                {deal.brandName}
              </div>
              <div className="text-gray-500">{deal.discountPercent}% off</div>
            </div>
            <a
              href={deal.ctaLink}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="shrink-0 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
            >
              Get deal
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
