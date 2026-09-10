"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReviewActionsProps {
  articleId: string;
  status: string;
  siteId: string;
  title: string;
  targetKeyword: string;
  searchIntent: string;
  brandNames: string[];
  isLocal: boolean;
}

type PendingAction = "approve" | "reject" | "retry" | "publish" | null;

interface HardFailWarning {
  passed: boolean | null;
  hard_fail_reason: string;
}

export default function ReviewActions({
  articleId,
  status,
  siteId,
  title,
  targetKeyword,
  searchIntent,
  brandNames,
  isLocal,
}: ReviewActionsProps) {
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState("");
  const [pending, setPending] = useState<PendingAction>(null);
  const [confirmingRetry, setConfirmingRetry] = useState(false);
  const [hardFailWarning, setHardFailWarning] = useState<HardFailWarning | null>(null);
  const [error, setError] = useState("");

  async function handlePublish() {
    setPending("publish");
    setError("");
    try {
      const res = await fetch(`/api/pipeline/articles/${articleId}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Publish failed");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setPending(null);
    }
  }

  if (status === "scheduled") {
    return (
      <div className="rounded-lg border border-line bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Actions
        </p>
        <p className="mt-2 text-sm text-muted">
          Scheduled — publishes automatically once its date arrives, or
          publish it now instead of waiting.
        </p>
        <button
          type="button"
          onClick={handlePublish}
          disabled={pending !== null}
          className="mt-3 inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
        >
          {pending === "publish" ? "Publishing…" : "Publish now"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (status !== "needs_review") {
    return (
      <p className="text-sm text-muted">
        This article is already {status.replace("_", " ")} — no actions to
        take.
      </p>
    );
  }

  async function handleApprove(confirmHardFail = false) {
    if (!scheduledFor) {
      setError("Pick a date first");
      return;
    }
    setPending("approve");
    setError("");
    try {
      const res = await fetch(`/api/pipeline/articles/${articleId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_for: scheduledFor,
          confirm_hard_fail: confirmHardFail,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && typeof data?.hard_fail_reason === "string") {
        // Best draft didn't pass review — show the real reason and require
        // an explicit second click before overriding, don't silently retry.
        setHardFailWarning({
          passed: data.passed ?? null,
          hard_fail_reason: data.hard_fail_reason,
        });
      } else if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Approve failed");
      } else {
        setHardFailWarning(null);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setPending(null);
    }
  }

  async function handleReject() {
    setPending("reject");
    setError("");
    try {
      const res = await fetch(`/api/pipeline/articles/${articleId}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Reject failed");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setPending(null);
    }
  }

  async function handleRetry() {
    setPending("retry");
    setError("");
    try {
      const res = await fetch("/api/loop-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: siteId,
          title,
          target_keyword: targetKeyword,
          search_intent: searchIntent,
          // Supporting keywords were never persisted anywhere, so a retry
          // can't recover them — best-effort resubmission per the Phase 7
          // decision.
          keywords: [],
          brand_names: brandNames,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Retry failed");
      } else if (data?.article_id) {
        router.push(`/review-queue/${data.article_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setPending(null);
      setConfirmingRetry(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        Actions
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-ink focus:border-line focus:outline-none"
        />
        <button
          type="button"
          onClick={() => handleApprove(false)}
          disabled={pending !== null}
          className="inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600"
        >
          {pending === "approve" ? "Approving…" : "Approve"}
        </button>

        <button
          type="button"
          onClick={handleReject}
          disabled={pending !== null}
          className="inline-flex items-center rounded-md border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-muted"
        >
          {pending === "reject" ? "Rejecting…" : "Reject"}
        </button>

        {confirmingRetry ? (
          <button
            type="button"
            onClick={handleRetry}
            disabled={pending !== null || !isLocal}
            className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === "retry" ? "Starting…" : "Confirm retry — spends API credits"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingRetry(true)}
            disabled={pending !== null || !isLocal}
            className="inline-flex items-center rounded-md border border-line bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent-soft disabled:cursor-not-allowed disabled:text-muted"
            title={isLocal ? undefined : "Local-only for now"}
          >
            Retry
          </button>
        )}
      </div>

      {hardFailWarning && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="font-semibold text-amber-800 dark:text-amber-400">
            The best draft for this article did not pass review.
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-400">
            {hardFailWarning.hard_fail_reason}
          </p>
          <button
            type="button"
            onClick={() => handleApprove(true)}
            disabled={pending !== null}
            className="mt-2 inline-flex items-center rounded-md border border-amber-400 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending === "approve" ? "Approving…" : "Approve anyway, despite the failure"}
          </button>
        </div>
      )}

      {!isLocal && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Retry is local-only for now — run the dashboard locally to use it.
        </p>
      )}

      <p className="mt-2 text-xs text-muted">
        Retry creates a new article with a fresh attempt count — this one
        stays in the queue as-is.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
