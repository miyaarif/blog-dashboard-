const STATUS_STYLES: Record<string, string> = {
  idea: "bg-gray-100 text-gray-600",
  outlined: "bg-blue-50 text-blue-700",
  drafted: "bg-amber-50 text-amber-700",
  needs_review: "bg-red-50 text-red-700",
  scheduled: "bg-indigo-50 text-indigo-700",
  published: "bg-emerald-50 text-emerald-700",
};

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  outlined: "Outlined",
  drafted: "Drafted",
  needs_review: "Needs review",
  scheduled: "Scheduled",
  published: "Published",
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
