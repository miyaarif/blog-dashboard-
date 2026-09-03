import type { ArticleSection } from "@/lib/blogContent";
import { slugifyHeading } from "@/lib/blogContent";

// Auto-generated from the article's real H2/H3s — never a manually
// maintained list.
export default function TableOfContents({
  sections,
}: {
  sections: ArticleSection[];
}) {
  if (sections.length === 0) return null;

  return (
    <nav className="rounded-lg border border-line bg-card p-4 text-sm" aria-label="Table of contents">
      <div className="mb-2 font-semibold text-ink">On this page</div>
      <ul className="space-y-1">
        {sections.map((section) => (
          <li
            key={`${section.level}-${section.heading}`}
            className={section.level === 3 ? "pl-4" : ""}
          >
            <a
              href={`#${slugifyHeading(section.heading)}`}
              className="text-muted hover:text-ink hover:underline"
            >
              {section.heading}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
