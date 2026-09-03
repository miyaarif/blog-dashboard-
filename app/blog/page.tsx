import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBlogSite,
  getPublishedCount,
  getFeaturedArticles,
  getPublishedArticlesPage,
  BLOG_PAGE_SIZE,
} from "@/lib/blogQueries";
import { getBrandDealsForSite } from "@/app/api/blog/data";
import FeaturedCarousel from "@/components/blog/FeaturedCarousel";
import ArticleListItem from "@/components/blog/ArticleListItem";
import Pagination from "@/components/blog/Pagination";
import BestDealsWidget from "@/components/blog/BestDealsWidget";

export const dynamic = "force-dynamic";

// Each real site is its own blog (matches their real separate domains) —
// ?site= picks which one. Defaulting to site_scholar since it's the only
// site with enough real published content to be worth looking at today;
// this default is a judgment call, not something the spec pinned down.
const DEFAULT_SITE_ID = "site_scholar";

export default async function BlogListingPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; page?: string }>;
}) {
  const params = await searchParams;
  const siteId = params.site ?? DEFAULT_SITE_ID;
  const page = Math.max(1, Number(params.page) || 1);

  const site = await getBlogSite(siteId);
  if (!site) notFound();

  const [featured, { articles, totalCount }, publishedCount, deals] =
    await Promise.all([
      getFeaturedArticles(siteId),
      getPublishedArticlesPage(siteId, page),
      getPublishedCount(siteId),
      getBrandDealsForSite(siteId),
    ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / BLOG_PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav className="text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-900">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-900">Blog</span>
      </nav>

      <h1 className="mt-2 text-3xl font-bold text-gray-900">
        {site.name} Blog
      </h1>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FeaturedCarousel articles={featured} accentColour={site.primary_colour} />

          <h2 className="mt-10 text-xl font-bold text-gray-900">
            Latest Blog Posts
          </h2>
          <div className="mt-4">
            {articles.length === 0 ? (
              <p className="text-sm text-gray-500">No published articles yet.</p>
            ) : (
              articles.map((article) => (
                <ArticleListItem key={article.id} article={article} />
              ))
            )}
          </div>

          <Pagination siteId={siteId} currentPage={page} totalPages={totalPages} />
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-semibold text-gray-900">Our Blog</div>
            <div
              className="mt-1 text-2xl font-bold"
              style={{ color: site.primary_colour }}
            >
              {publishedCount}
            </div>
            <div className="text-sm text-gray-500">published articles</div>
          </div>

          <BestDealsWidget deals={deals} />
        </aside>
      </div>
    </div>
  );
}
