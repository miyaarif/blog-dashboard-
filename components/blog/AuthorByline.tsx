// Real byline only: author_name + author_credentials (both plain text
// columns on articles — there's no authors table, so no photo/bio/link).
// "Fact-checked by" uses reviewed_by, which is null on almost every real
// article — the line is omitted entirely rather than shown blank.
const FALLBACK_AUTHOR_NAME = "Editorial Team";

function getInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z]/g, ""))
    .filter((word) => word.length > 0);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface AuthorBylineProps {
  authorName: string;
  authorCredentials: string;
  lastUpdated: string | null;
  reviewedBy: string | null;
  accentColour: string;
}

export default function AuthorByline({
  authorName,
  authorCredentials,
  lastUpdated,
  reviewedBy,
  accentColour,
}: AuthorBylineProps) {
  const displayName =
    authorName.trim().length > 0 ? authorName.trim() : FALLBACK_AUTHOR_NAME;
  const credentials = authorCredentials.trim();

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: accentColour }}
        aria-hidden
      >
        {getInitials(displayName)}
      </div>
      <div className="text-sm">
        <div className="font-medium text-gray-900">
          {displayName}
          {credentials.length > 0 && (
            <span className="text-gray-500">, {credentials}</span>
          )}
        </div>
        <div className="text-[13px] font-normal text-[#64748B] sm:text-sm">
          {lastUpdated && <span>Last updated: {lastUpdated}</span>}
          {reviewedBy && (
            <span>
              {lastUpdated && " · "}
              Fact-checked by {reviewedBy}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
