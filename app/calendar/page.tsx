import { getArticles, getSites } from "@/lib/sites";
import { groupByDate, collisionsPerWeek } from "@/lib/calendarStats";
import { publishedPerWeek } from "@/lib/dashboardStats";
import CalendarGrid from "@/components/CalendarGrid";
import CalendarTrendWidgets from "@/components/CalendarTrendWidgets";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [articles, sites] = await Promise.all([getArticles(), getSites()]);

  const byDate = groupByDate(articles);
  const publishedWeeks = publishedPerWeek(articles);
  const collisionWeeks = collisionsPerWeek(articles);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        Publishing calendar
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Scheduled and published dates across the network.
      </p>

      <div className="mt-6">
        <CalendarTrendWidgets
          publishedWeeks={publishedWeeks}
          collisionWeeks={collisionWeeks}
        />
      </div>

      <div className="mt-4">
        <CalendarGrid byDate={byDate} sites={sites} />
      </div>
    </div>
  );
}
