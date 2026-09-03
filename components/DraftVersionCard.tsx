"use client";

import { useState } from "react";
import type { Draft, Grade } from "@/types";

function GradeBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        passed ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
      }`}
    >
      {passed ? "Passed" : "Failed"}
    </span>
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
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
          Hard fail: {grade.hard_fail_reason}
        </p>
      )}

      {grade?.verdict_summary && (
        <p className="mt-3 text-sm text-ink">{grade.verdict_summary}</p>
      )}

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
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-page p-3 text-xs text-ink">
          {draft.body_markdown}
        </pre>
      )}
    </div>
  );
}
