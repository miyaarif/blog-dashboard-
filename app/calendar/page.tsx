import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticles, getSites } from "@/lib/sites";
import { collisionsPerWeek } from "@/lib/calendarStats";
import { publishedPerWeek } from "@/lib/dashboardStats";
import CalendarGrid from "@/components/CalendarGrid";
import CalendarTrendWidgets from "@/components/CalendarTrendWidgets";

export const dynamic = "force-dynamic";

// Same default as /blog — site_scholar has the most real content, and
// keeping the two pages consistent means one default to remember.
const DEFAULT_SITE_ID = "site_scholar";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const siteId = params.site ?? DEFAULT_SITE_ID;

  const [allArticles, sites] = await Promise.all([getArticles(), getSites()]);
  const site = sites.find((s) => s.id === siteId);
  if (!site) notFound();

  const siteArticles = allArticles.filter((a) => a.site_id === site.id);
  const publishedWeeks = publishedPerWeek(siteArticles);
  const collisionWeeks = collisionsPerWeek(siteArticles);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        Publishing calendar
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Scheduled and published dates for {site.name}.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {sites.map((s) => (
          <Link
            key={s.id}
            href={`/calendar?site=${s.id}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              s.id === site.id
                ? "border-transparent text-white"
                : "border-gray-300 text-gray-600 hover:bg-gray-100"
            }`}
            style={s.id === site.id ? { backgroundColor: s.primary_colour } : undefined}
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: s.id === site.id ? "#ffffff" : s.primary_colour }}
            />
            {s.name}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <CalendarTrendWidgets
          publishedWeeks={publishedWeeks}
          collisionWeeks={collisionWeeks}
        />
      </div>

      <div className="mt-4">
        <CalendarGrid articles={siteArticles} site={site} />
      </div>
    </div>
  );
}
