import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getArticleById, getSiteById } from "@/lib/sites";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import HeroImage from "@/components/HeroImage";
import { PencilIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

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

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/articles"
        className="text-sm text-muted hover:text-ink"
      >
        ← Back to articles
      </Link>

      <HeroImage
        src={article.hero_image_url}
        alt={article.hero_image_alt ?? ""}
        className="mt-4 aspect-[1200/630] w-full rounded-lg border border-line object-cover"
        fallback="hidden"
      />

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {site && <SiteBadge site={site} />}
            <StatusPill status={article.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-ink">
            {article.title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {article.meta_description}
          </p>
        </div>
        <Link
          href={`/editor/${article.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-accent-soft"
        >
          <PencilIcon className="h-3.5 w-3.5" />
          Edit
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-line bg-card p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Author</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {article.author_name}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Word count</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {article.word_count}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Sessions / 30d</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {article.organic_sessions_30d}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Last updated</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {article.last_updated?.split("T")[0] ?? "—"}
          </dd>
        </div>
      </dl>

      <article className="prose prose-sm mt-6 max-w-none rounded-lg border border-line bg-card p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {article.body_markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
