import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getArticleById, getSiteById } from "@/lib/sites";
import { buildCanonicalUrl } from "@/lib/blogMetadata";
import { ebGaramond } from "@/lib/fonts";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import HeroImage from "@/components/HeroImage";
import ArticleShareRow from "@/components/ArticleShareRow";
import { PencilIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

// Hero images are generated server-side at a fixed 1200x630 (lib/heroImage.tsx)
// with the site label and title baked into the pixels close to the edges.
// Stretching that box to a taller/narrower shape (object-fit: cover forced
// to h-full on a column with a very different aspect ratio) crops deep into
// that text from both sides. Keeping the box at the image's real aspect
// ratio avoids the crop at every width -- this is deliberately NOT
// "aspect-auto + h-full" on desktop, which is what caused the clipping.
const HERO_IMAGE_CLASS =
  "aspect-[1200/630] w-full self-start rounded-[14px] border border-line object-cover";

export default async function ArticleReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article) {
    notFound();
  }

  const site = await getSiteById(article.site_id);
  const accentColor = site?.primary_colour ?? "#2563eb";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/articles" className="text-sm text-muted hover:text-ink">
          ← Back to articles
        </Link>
        <Link
          href={`/editor/${article.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-accent-soft"
        >
          <PencilIcon className="h-3.5 w-3.5" />
          Edit
        </Link>
      </div>

      {/* Hero: two columns above ~720px, single column (image below the
          title block) at or below it. */}
      <div className="mt-6 grid grid-cols-1 gap-8 min-[721px]:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {site && <SiteBadge site={site} />}
            <StatusPill status={article.status} />
          </div>

          <h1
            className={`${ebGaramond.className} mt-3 text-[38px] font-medium leading-[1.15] text-ink sm:text-[40px]`}
          >
            {article.title}
          </h1>

          {article.meta_description && (
            <p
              className={`${ebGaramond.className} mt-3 text-lg italic text-muted`}
            >
              {article.meta_description}
            </p>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-line py-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Author
              </dt>
              <dd className="mt-1 font-medium text-ink">
                {article.author_name}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Word count
              </dt>
              <dd className="mt-1 font-medium text-ink">
                {article.word_count}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Sessions / 30d
              </dt>
              <dd className="mt-1 font-medium text-ink">
                {article.organic_sessions_30d}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Last updated
              </dt>
              <dd className="mt-1 font-medium text-ink">
                {(article.last_updated ?? article.updated_at).split("T")[0]}
              </dd>
            </div>
          </dl>

          {site && (
            <ArticleShareRow
              url={buildCanonicalUrl(site.domain, article.slug)}
              title={article.title}
              accentColor={accentColor}
            />
          )}
        </div>

        <HeroImage
          src={article.hero_image_url}
          alt={article.hero_image_alt ?? ""}
          className={HERO_IMAGE_CLASS}
          fallbackClassName={`${HERO_IMAGE_CLASS} bg-card`}
          fallback="box"
        />
      </div>

      <article
        className={`${ebGaramond.className} article-editorial mx-auto mt-12 max-w-[700px]`}
        style={{ "--article-accent": accentColor } as CSSProperties}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {article.body_markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
