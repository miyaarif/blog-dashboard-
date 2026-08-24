import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Page not found",
};

function LostIllustration() {
  return (
    <svg
      viewBox="0 0 200 150"
      className="h-36 w-auto sm:h-44"
      aria-hidden="true"
      fill="none"
    >
      {/* document, slightly tilted */}
      <g transform="rotate(-6 80 78)">
        <path
          d="M45 30h60l20 20v80a4 4 0 0 1-4 4H45a4 4 0 0 1-4-4V34a4 4 0 0 1 4-4Z"
          fill="#fff"
          stroke="#c3c2b7"
          strokeWidth="2"
        />
        <path d="M105 30v16a4 4 0 0 0 4 4h16" stroke="#c3c2b7" strokeWidth="2" />
        <path
          d="M56 68h44M56 82h44M56 96h28"
          stroke="#dcdad2"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>

      {/* magnifying glass, searching over the document */}
      <g transform="translate(4 4)">
        <circle cx="128" cy="92" r="26" fill="#f3f2ee" stroke="#898781" strokeWidth="4" />
        <line
          x1="147"
          y1="111"
          x2="168"
          y2="132"
          stroke="#898781"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <text
          x="128"
          y="99"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill="#0b0b0b"
        >
          ?
        </text>
      </g>

      {/* scattered dashes suggesting a broken/lost trail */}
      <circle cx="24" cy="112" r="3" fill="#dcdad2" />
      <circle cx="14" cy="96" r="2" fill="#dcdad2" />
      <circle cx="178" cy="34" r="3" fill="#dcdad2" />
      <circle cx="186" cy="48" r="2" fill="#dcdad2" />
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[75vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center sm:px-10">
      <div className="fade-in-up flex flex-col items-center">
        <LostIllustration />

        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          Oops! Looks like you&apos;re lost
        </h1>
        <p className="mt-3 max-w-sm text-sm text-gray-500">
          The page you are looking for doesn&apos;t exist, was moved, or the
          link might be broken.
        </p>

        <form
          action="/articles"
          method="GET"
          className="relative mt-8 w-full max-w-sm"
        >
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            name="search"
            placeholder="Search articles…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            ← Return to Overview
          </Link>
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            View Articles
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {[
            { label: "Drafts", href: "/articles?status=drafted" },
            { label: "Calendar", href: "/calendar" },
            { label: "Keywords", href: "/keywords" },
          ].map((chip) => (
            <Link
              key={chip.href}
              href={chip.href}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
