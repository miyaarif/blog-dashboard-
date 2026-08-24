import { getSites, getArticles } from "@/lib/sites";
import ArticlesTable from "@/components/ArticlesTable";

export const dynamic = "force-dynamic";

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{
    site?: string;
    status?: string;
    from?: string;
    to?: string;
    search?: string;
  }>;
}) {
  const [sites, articles] = await Promise.all([getSites(), getArticles()]);
  const { site, status, from, to, search } = await searchParams;

  return (
    <ArticlesTable
      sites={sites}
      articles={articles}
      initialSiteFilter={site}
      initialStatusFilter={status}
      initialFrom={from}
      initialTo={to}
      initialSearch={search}
    />
  );
}
