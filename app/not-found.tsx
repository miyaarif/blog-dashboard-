import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-7xl font-bold tracking-tight text-gray-200 sm:text-8xl">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900 sm:text-3xl">
        Page not found
      </h1>
      <p className="mt-3 max-w-sm text-sm text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist, was moved, or the
        link is broken.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
        >
          ← Back to overview
        </Link>
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          View articles
        </Link>
      </div>
    </div>
  );
}
