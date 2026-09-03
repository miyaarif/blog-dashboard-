function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton animate-pulse rounded ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <Bar className="h-7 w-40" />
      <Bar className="mt-2 h-4 w-56" />

      <div className="mt-6 divide-y divide-gray-100 rounded-lg border border-line bg-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0 flex-1">
              <Bar className="h-4 w-2/3" />
              <Bar className="mt-2 h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
