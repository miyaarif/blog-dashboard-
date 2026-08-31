function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton animate-pulse rounded ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Bar className="h-4 w-32" />
      <Bar className="mt-4 h-7 w-2/3" />
      <Bar className="mt-2 h-4 w-40" />

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <Bar className="h-3 w-20" />
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <Bar className="h-3 w-16" />
        <Bar className="mt-3 h-9 w-64" />
      </div>

      <div className="mt-6 space-y-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-5">
            <Bar className="h-4 w-24" />
            <Bar className="mt-2 h-3 w-40" />
            <Bar className="mt-4 h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
