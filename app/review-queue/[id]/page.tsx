import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleById, getSiteById } from "@/lib/sites";
import { getBaseUrl } from "@/lib/internalUrl";
import SiteBadge from "@/components/SiteBadge";
import StatusPill from "@/components/StatusPill";
import DraftVersionCard from "@/components/DraftVersionCard";
import ReviewActions from "@/components/ReviewActions";
import type { Draft, Grade, LoopRun } from "@/types";

export const dynamic = "force-dynamic";

interface PipelineDetail {
  drafts: Draft[];
  grades: Grade[];
  loop_run: LoopRun | null;
  brands: { id: string; name: string }[];
}

export default async function ReviewQueueDetailPage({
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

  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}/api/pipeline/articles/${id}/pipeline-detail`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Could not load pipeline detail for this article");
  }
  const detail = (await res.json()) as PipelineDetail;

  const gradeByDraftId = new Map(detail.grades.map((g) => [g.draft_id, g]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Link
        href="/review-queue"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        ← Back to review queue
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink">{article.title}</h1>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {site && <SiteBadge site={site} />}
        <StatusPill status={article.status} />
      </div>

      {detail.loop_run && (
        <div className="mt-6 rounded-lg border border-line bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Loop run
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted sm:grid-cols-4">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Outcome
              </dt>
              <dd className="font-medium text-ink">
                {detail.loop_run.outcome}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Attempts
              </dt>
              <dd>{detail.loop_run.attempts_used}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                First score
              </dt>
              <dd>{detail.loop_run.first_score ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Final score
              </dt>
              <dd>{detail.loop_run.final_score ?? "—"}</dd>
            </div>
          </dl>
          {detail.loop_run.error_detail && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {detail.loop_run.error_detail}
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        <ReviewActions
          articleId={article.id}
          status={article.status}
          siteId={article.site_id}
          title={article.title}
          targetKeyword={article.target_keyword}
          searchIntent={article.search_intent}
          brandNames={detail.brands.map((b) => b.name)}
          isLocal={!process.env.VERCEL}
        />
      </div>

      <div className="mt-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Draft versions ({detail.drafts.length})
        </p>
        {detail.drafts.map((draft) => (
          <DraftVersionCard
            key={draft.id}
            draft={draft}
            grade={gradeByDraftId.get(draft.id)}
          />
        ))}
        {detail.drafts.length === 0 && (
          <p className="text-sm text-muted">No draft versions recorded.</p>
        )}
      </div>
    </div>
  );
}
