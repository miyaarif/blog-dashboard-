function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton animate-pulse rounded ${className}`} />;
}

export default function EditorSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between">
        <Bar className="h-4 w-16" />
        <Bar className="h-9 w-20" />
      </div>

      <Bar className="mt-4 h-7 w-40" />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-line bg-card p-5">
          {/* Title input */}
          <div>
            <Bar className="h-3 w-16" />
            <Bar className="mt-1.5 h-8 w-full" />
          </div>
          {["w-24", "w-32", "w-20", "w-28"].map((w, i) => (
            <div key={i}>
              <Bar className={`h-3 ${w}`} />
              <Bar className="mt-1.5 h-8 w-full" />
            </div>
          ))}

          {/* Body — a set of paragraph-like lines rather than one solid
              block, matching the plain markdown textarea's real bounding
              box while reading as text rather than a blank rectangle. */}
          <div className="space-y-2 rounded-md border border-line p-3">
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-11/12" />
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-2/3" />
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-4/5" />
          </div>

          <Bar className="h-24 w-full" />
        </div>

        <div className="rounded-lg border border-line bg-card p-5">
          <Bar className="h-3 w-24" />
          <Bar className="mt-3 h-6 w-3/4" />
          <div className="mt-4 space-y-2">
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
