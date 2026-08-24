"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          className="h-7 w-7 text-red-500"
        >
          <path
            d="M10 2.5 18 16.5H2L10 2.5Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10 8v3.5" strokeLinecap="round" />
          <circle cx="10" cy="14" r="0.7" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-semibold text-gray-900">
        Couldn&apos;t load this page
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Something went wrong reaching the database. This is usually
        temporary — try again in a moment.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-gray-300">Reference: {error.digest}</p>
      )}
      <button
        onClick={() => retry()}
        className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        Retry connection
      </button>
    </div>
  );
}
