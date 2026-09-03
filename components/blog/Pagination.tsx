import Link from "next/link";

// Real page count derived from the actual published article count passed
// in — never a hardcoded number of pages.
export default function Pagination({
  siteId,
  currentPage,
  totalPages,
}: {
  siteId: string;
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pageHref = (page: number) =>
    page === 1 ? `/blog?site=${siteId}` : `/blog?site=${siteId}&page=${page}`;

  return (
    <nav className="mt-8 flex items-center justify-center gap-1" aria-label="Pagination">
      <Link
        href={pageHref(Math.max(1, currentPage - 1))}
        aria-disabled={currentPage === 1}
        className={`rounded-md border px-3 py-1.5 text-sm ${
          currentPage === 1
            ? "pointer-events-none border-gray-100 text-gray-300"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        Prev
      </Link>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <Link
          key={page}
          href={pageHref(page)}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            page === currentPage
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          {page}
        </Link>
      ))}
      <Link
        href={pageHref(Math.min(totalPages, currentPage + 1))}
        aria-disabled={currentPage === totalPages}
        className={`rounded-md border px-3 py-1.5 text-sm ${
          currentPage === totalPages
            ? "pointer-events-none border-gray-100 text-gray-300"
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        Next
      </Link>
    </nav>
  );
}
