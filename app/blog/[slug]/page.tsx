import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogSite, getPublishedArticleBySlug } from "@/lib/blogQueries";
import { getBrandDealForArticle, getComplianceConfig } from "@/app/api/blog/data";
import { parseArticleBody, extractFaqPairs } from "@/lib/blogContent";
import {
  buildArticleMetadata,
  buildArticleJsonLd,
  buildFaqJsonLd,
  buildCanonicalUrl,
} from "@/lib/blogMetadata";
import HeroImage from "@/components/HeroImage";
import AuthorByline from "@/components/blog/AuthorByline";
import CalloutBox from "@/components/blog/CalloutBox";
import TableOfContents from "@/components/blog/TableOfContents";
import ArticleMarkdown from "@/components/blog/ArticleMarkdown";
import BestDealsWidget from "@/components/blog/BestDealsWidget";

export const dynamic = "force-dynamic";

// Real per-article SEO metadata (Fix 7). Re-fetches the article/site --
// Next.js doesn't automatically dedupe this against the page's own
// fetch below without wrapping both in React's cache(), which isn't
// used anywhere else in this codebase yet; two small reads on a
// low-traffic page isn't worth adding that machinery for now.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) return {};

  const site = await getBlogSite(article.site_id);
  if (!site) return {};

  return buildArticleMetadata(article, site);
}

// last_updated is a real editorial date but is only populated on older
// articles (seeded before the current pipeline). Every article has a real
// updated_at from Postgres, so that's the honest fallback when
// last_updated is null — never leave a real article with no date shown
// when a real timestamp exists. last_updated is date-only ("2026-06-13");
// updated_at is a full timestamptz — both need to parse correctly.
function formatLastUpdated(value: string): string {
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

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
  const complianceConfig = await getComplianceConfig(site.id);
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

  // last_updated is real but only populated on older, pre-pipeline
  // articles; updated_at is set by Postgres on every row, so it's the
  // honest fallback rather than showing no date on newer real articles.
  const rawUpdatedDate = article.last_updated ?? article.updated_at;
  const displayUpdatedDate = rawUpdatedDate
    ? formatLastUpdated(rawUpdatedDate)
    : null;

  const canonicalUrl = buildCanonicalUrl(site.domain, article.slug);
  const articleJsonLd = buildArticleJsonLd(article, site, canonicalUrl);
  const faqPairs = faq ? extractFaqPairs(faq) : [];
  const faqJsonLd = buildFaqJsonLd(faqPairs);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <nav className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/blog?site=${site.id}`} className="hover:text-ink">
          Blog
        </Link>
      </nav>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-[28px] leading-[1.2] font-bold text-ink sm:text-[32px]">
            {article.title}
          </h1>

          <div className="mt-4">
            <AuthorByline
              authorName={article.author_name}
              authorCredentials={article.author_credentials}
              lastUpdated={displayUpdatedDate}
              reviewedBy={article.reviewed_by}
              accentColour={site.primary_colour}
            />
          </div>

          <HeroImage
            src={article.hero_image_url}
            alt={article.hero_image_alt ?? ""}
            className="mt-6 aspect-[1200/630] w-full rounded-lg object-cover"
            fallbackClassName="mt-6 aspect-[1200/630] w-full rounded-lg bg-gray-100 dark:bg-gray-800"
          />

          <div className="prose prose-sm mt-6 max-w-none dark:prose-invert">
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

          {complianceConfig.federalAidNote && (
            <p className="mt-6 text-sm text-muted italic">
              {complianceConfig.federalAidNote}
            </p>
          )}

          <div className="prose prose-sm mt-6 max-w-none dark:prose-invert">
            {sections.map((section) => (
              <div key={`${section.level}-${section.heading}`}>
                <ArticleMarkdown>{`${"#".repeat(section.level)} ${section.heading}\n\n${section.content}`}</ArticleMarkdown>
              </div>
            ))}
          </div>

          {deal && (
            <div className="mt-8 rounded-lg border border-line bg-card p-5">
              <div className="text-sm font-semibold text-ink">Our choice</div>
              <div className="mt-2 text-lg font-bold text-ink">{deal.brandName}</div>
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
            <div className="prose prose-sm mt-8 max-w-none dark:prose-invert">
              <h2>FAQ</h2>
              <ArticleMarkdown>{faq}</ArticleMarkdown>
            </div>
          )}

          {deal && (
            <div className="mt-8">
              <BestDealsWidget deals={[deal]} />
            </div>
          )}

          {(complianceConfig.advisorDisclaimer || complianceConfig.affiliateDisclosure) && (
            <div className="mt-8 space-y-2 border-t border-line pt-6 text-xs text-muted">
              {complianceConfig.advisorDisclaimer && <p>{complianceConfig.advisorDisclaimer}</p>}
              {complianceConfig.affiliateDisclosure && <p>{complianceConfig.affiliateDisclosure}</p>}
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
