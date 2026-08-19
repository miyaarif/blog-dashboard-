const STATUS_COLORS: Record<string, string> = {
  idea: "#e5e7eb",
  outlined: "#dbeafe",
  drafted: "#fef3c7",
  needs_review: "#fee2e2",
  scheduled: "#e0e7ff",
  published: "#dcfce7",
};

export default function StatusPill({ status }: { status: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 4,
        backgroundColor: STATUS_COLORS[status] ?? "#e5e7eb",
        color: "#1f2937",
      }}
    >
      {status}
    </span>
  );
}
