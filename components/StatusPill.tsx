const STATUS_STYLES: Record<string, string> = {
  idea: "bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400",
  outlined: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  drafted: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  needs_review: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  scheduled: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rejected: "bg-gray-200 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  outlined: "Outlined",
  drafted: "Drafted",
  needs_review: "Needs review",
  scheduled: "Scheduled",
  published: "Published",
  rejected: "Rejected",
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ??
        "bg-gray-100 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
