"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Draft, Grade } from "@/types";

function GradeBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
        passed ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
      }`}
    >
      {passed ? "Passed" : "Failed"}
    </span>
  );
}

// Manager feedback (Section 5): "log the per-check breakdown so we can
// see why an article scored what it did." grades.scores already holds
// every rubric criterion's 1-5 score, but until now the UI only showed
// issues for criteria that scored <=3 -- a criterion that scored 4
// (fine, but not perfect) was invisible. Shown for every graded draft,
// not just failing ones, and sorted worst-first so the weakest real
// criterion is always the first thing a reviewer sees.
function formatCriterionName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function scoreBadgeClass(score: number): string {
  if (score <= 2) return "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
  if (score === 3) return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
  return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
}

function ScoreBreakdown({ scores }: { scores: Record<string, number> }) {
  const entries = Object.entries(scores).sort(([, a], [, b]) => a - b);
  if (entries.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Score breakdown
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {entries.map(([criterion, score]) => (
          <div
            key={criterion}
            className="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1.5"
          >
            <span className="text-xs text-ink">{formatCriterionName(criterion)}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${scoreBadgeClass(score)}`}
            >
              {score}/5
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DraftVersionCard({
  draft,
  grade,
}: {
  draft: Draft;
  grade: Grade | undefined;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          Version {draft.version}
        </h3>
        <div className="flex items-center gap-2">
          {grade && <GradeBadge passed={grade.passed} />}
          {grade && (
            <span className="text-sm text-muted">
              {grade.weighted_total} / 100
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 text-xs text-muted">
        {draft.word_count ?? "—"} words · model {draft.model ?? "—"}
      </p>

      {!grade && (
        <p className="mt-3 text-sm text-muted">Not graded yet.</p>
      )}

      {grade?.hard_fail_reason && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700 dark:bg-red-500/10 dark:text-red-400">
          Hard fail: {grade.hard_fail_reason}
        </p>
      )}

      {grade?.verdict_summary && (
        <p
          className={`mt-3 text-sm font-bold ${
            grade.passed
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-700 dark:text-red-400"
          }`}
        >
          {grade.verdict_summary}
        </p>
      )}

      {grade && <ScoreBreakdown scores={grade.scores} />}

      {grade && grade.issues.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Issues ({grade.issues.length})
          </p>
          {grade.issues.map((issue, i) => (
            <div key={i} className="rounded-md border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {issue.criterion}
                </span>
                <span className="text-xs text-muted">{issue.severity}</span>
              </div>
              <p className="mt-1.5 text-sm text-ink">
                <span className="font-medium">Quote:</span> &ldquo;{issue.quote}&rdquo;
              </p>
              <p className="mt-1 text-sm text-ink">
                <span className="font-medium">Problem:</span> {issue.problem}
              </p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                <span className="font-medium">Suggested fix:</span>{" "}
                {issue.suggested_fix}
              </p>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 text-sm font-medium text-muted hover:text-ink"
      >
        {expanded ? "Hide draft text" : "Show draft text"}
      </button>

      {expanded && (
        <article className="prose prose-sm mt-3 max-h-96 max-w-none overflow-auto rounded-md border border-line bg-page p-4 dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {draft.body_markdown}
          </ReactMarkdown>
        </article>
      )}
    </div>
  );
}
