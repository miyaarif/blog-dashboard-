function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton animate-pulse rounded ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Bar className="h-7 w-40" />
      <Bar className="mt-2 h-4 w-72" />

      <div className="mt-6 space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        {["w-16", "w-20", "w-56", "w-48"].map((w, i) => (
          <div key={i}>
            <Bar className={`h-3 ${w}`} />
            <Bar className="mt-1.5 h-8 w-full" />
          </div>
        ))}
        <Bar className="h-9 w-28" />
      </div>
    </div>
  );
}
