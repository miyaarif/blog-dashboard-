// ------------------------------------------------------------
// Fix 7 (manager feedback, blog-pipeline-v1-feedback.md section 6) --
// real per-article SEO metadata + Article JSON-LD. Reads directly from
// the real articles/sites rows the page already fetches -- no new data
// source, nothing invented. Author is the site itself (an Organization),
// never a fabricated person -- same principle as the fabricated-byline
// hard-fail rule elsewhere in this pipeline: don't claim a human did
// something no human did.
// ------------------------------------------------------------
import type { Metadata } from "next";
import type { Article, Site } from "@/types";
import type { FaqPair } from "@/lib/blogContent";

// The manager's feedback doc's own guidance (title <=60, description
// <=155) -- a real-world SEO rule of thumb (Google's SERP truncates by
// pixel width, not exact character count), not a hard technical limit.
// Cuts at the last word boundary so a shortened value never ends
// mid-word. Two real published articles exceed 60 chars in title today
// (art_0015 at 111, art_0046 at 97, both old seed content with a
// leftover "-- The Complete Guide To..." suffix) -- this truncates the
// rendered <title>/meta tags only, it never touches the real title
// text stored on the article or shown as the on-page H1.
const TITLE_MAX_CHARS = 60;
const DESCRIPTION_MAX_CHARS = 155;

export function truncateForMeta(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

export function buildCanonicalUrl(domain: string, slug: string): string {
  return `https://${domain}/blog/${slug}`;
}

export function buildArticleMetadata(article: Article, site: Site): Metadata {
  const title = truncateForMeta(article.title, TITLE_MAX_CHARS);
  // Real articles always have meta_description populated in practice,
  // but this is a public page reading real, mutable data -- fall back
  // to the real title rather than emit an empty description tag.
  const description = truncateForMeta(
    article.meta_description || article.title,
    DESCRIPTION_MAX_CHARS,
  );
  const canonicalUrl = buildCanonicalUrl(site.domain, article.slug);
  const ogImages = article.hero_image_url
    ? [{ url: article.hero_image_url, alt: article.hero_image_alt ?? article.title }]
    : undefined;

  return {
    title,
    description,
    // Real target_keyword only -- checked whether a secondary-keyword
    // field exists (keywords.assigned_article_id) and confirmed it's a
    // 1:1 mapping with target_keyword, not a real distinct secondary
    // list, so nothing invented here.
    keywords: article.target_keyword ? [article.target_keyword] : undefined,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: site.name,
      type: "article",
      images: ogImages,
    },
    twitter: {
      card: ogImages ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImages?.map((img) => img.url),
    },
  };
}

// Author and publisher are the site itself, never a person -- this
// pipeline already has a hard rule against fabricated bylines
// (findFabricatedByline in lib/pipelineShared.ts); claiming a named
// human wrote/reviewed an article JSON-LD block would be the same
// defect in a different field.
export function buildArticleJsonLd(
  article: Article,
  site: Site,
  canonicalUrl: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description || undefined,
    image: article.hero_image_url ? [article.hero_image_url] : undefined,
    datePublished: article.published_at ?? article.created_at,
    dateModified: article.updated_at,
    author: {
      "@type": "Organization",
      name: site.name,
      url: `https://${site.domain}`,
    },
    publisher: {
      "@type": "Organization",
      name: site.name,
      logo: site.logo_url
        ? { "@type": "ImageObject", url: site.logo_url }
        : undefined,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };
}

// Second, separate JSON-LD block alongside Article, not a replacement
// for it. Returns null when there's no real FAQ section or extraction
// found zero genuine pairs -- omit the block entirely rather than
// emit an empty/broken FAQPage schema.
export function buildFaqJsonLd(pairs: FaqPair[]): Record<string, unknown> | null {
  if (pairs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map((pair) => ({
      "@type": "Question",
      name: pair.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: pair.answer,
      },
    })),
  };
}
