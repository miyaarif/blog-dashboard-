import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogSite, getPublishedArticleBySlug } from "@/lib/blogQueries";
import { getBrandDealForArticle } from "@/app/api/blog/data";
import { parseArticleBody } from "@/lib/blogContent";
import HeroImage from "@/components/HeroImage";
import AuthorByline from "@/components/blog/AuthorByline";
import CalloutBox from "@/components/blog/CalloutBox";
import TableOfContents from "@/components/blog/TableOfContents";
import ArticleMarkdown from "@/components/blog/ArticleMarkdown";
import BestDealsWidget from "@/components/blog/BestDealsWidget";

export const dynamic = "force-dynamic";

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const site = await getBlogSite(article.site_id);
  if (!site) notFound();

  const deal = await getBrandDealForArticle(article.id);
  const { quickAnswer, keyTakeaways, faq, sections } = parseArticleBody(
    article.body_markdown,
  );

  // A "Key takeaways" section only exists on articles from writer v3+,
  // which is also the prompt version that introduced the dedicated
  // quick-answer block (supabase/migrations/20260902_writer_prompt_v4_...,
  // rules 8-9: the quick-answer block sits directly above "## Key
  // takeaways"). There's no schema flag recording which prompt version
  // wrote a given article, so this is the real, structural stand-in for
  // "this article actually has a deliberate quick-answer block" rather
  // than just an ordinary opening paragraph from an older article.
  const hasStructuredOpening = keyTakeaways !== null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <nav className="text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-900">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/blog?site=${site.id}`} className="hover:text-gray-900">
          Blog
        </Link>
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-[28px] leading-[1.2] font-bold text-[#0F172A] sm:text-[32px]">
            {article.title}
          </h1>

          <div className="mt-4">
            <AuthorByline
              authorName={article.author_name}
              authorCredentials={article.author_credentials}
              lastUpdated={article.last_updated}
              reviewedBy={article.reviewed_by}
              accentColour={site.primary_colour}
            />
          </div>

          <HeroImage
            src={article.hero_image_url}
            alt={article.hero_image_alt ?? ""}
            className="mt-6 aspect-[1200/630] w-full rounded-lg object-cover"
            fallbackClassName="mt-6 aspect-[1200/630] w-full rounded-lg bg-gray-100"
          />

          <div className="prose prose-sm mt-6 max-w-none">
            {hasStructuredOpening && quickAnswer ? (
              <CalloutBox variant="quick-answer" accentColour={site.primary_colour}>
                <ArticleMarkdown>{quickAnswer}</ArticleMarkdown>
              </CalloutBox>
            ) : (
              quickAnswer && <ArticleMarkdown>{quickAnswer}</ArticleMarkdown>
            )}
          </div>

          <div className="mt-6 lg:hidden">
            <TableOfContents sections={sections} />
          </div>

          {hasStructuredOpening && keyTakeaways && (
            <div className="mt-6">
              <CalloutBox variant="key-takeaways" accentColour={site.primary_colour}>
                <ArticleMarkdown>{keyTakeaways}</ArticleMarkdown>
              </CalloutBox>
            </div>
          )}

          <div className="prose prose-sm mt-6 max-w-none">
            {sections.map((section) => (
              <div key={`${section.level}-${section.heading}`}>
                <ArticleMarkdown>{`${"#".repeat(section.level)} ${section.heading}\n\n${section.content}`}</ArticleMarkdown>
              </div>
            ))}
          </div>

          {deal && (
            <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
              <div className="text-sm font-semibold text-gray-900">Our choice</div>
              <div className="mt-2 text-lg font-bold">{deal.brandName}</div>
              <a
                href={deal.ctaLink}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="mt-3 inline-block rounded-md px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: site.primary_colour }}
              >
                Get {deal.discountPercent}% off
              </a>
            </div>
          )}

          {faq && (
            <div className="prose prose-sm mt-8 max-w-none">
              <h2>FAQ</h2>
              <ArticleMarkdown>{faq}</ArticleMarkdown>
            </div>
          )}

          {deal && (
            <div className="mt-8">
              <BestDealsWidget deals={[deal]} />
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="hidden lg:block lg:sticky lg:top-20">
            <TableOfContents sections={sections} />
            <div className="mt-6">
              <BestDealsWidget deals={deal ? [deal] : []} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
