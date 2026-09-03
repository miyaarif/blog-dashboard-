"use client";

import { useState } from "react";
import Link from "next/link";
import type { Article } from "@/types";

// Real recent published posts only — background is each article's real
// generated hero image (1200x630), not a placeholder. The hero image
// already draws the real title (bottom) and site icon/name (top) into
// itself (lib/heroImage.tsx) — confirmed via a real mobile screenshot that
// adding our own title overlay on top just double-renders the same text.
// So this only adds a "Featured" tag, positioned top-right to stay clear
// of the image's own top-left site badge, not a second title.
export default function FeaturedCarousel({
  articles,
  accentColour,
}: {
  articles: Article[];
  accentColour: string;
}) {
  const [index, setIndex] = useState(0);

  if (articles.length === 0) return null;

  const current = articles[index];
  const go = (next: number) =>
    setIndex((next + articles.length) % articles.length);

  return (
    <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-lg bg-gray-900">
      <Link href={`/blog/${current.slug}`} className="absolute inset-0">
        {current.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.hero_image_url}
            alt={current.hero_image_alt ?? ""}
            className="h-full w-full object-cover"
          />
        )}
        <span
          className="absolute right-4 top-4 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm"
          style={{ backgroundColor: accentColour }}
        >
          Featured
        </span>
      </Link>

      {articles.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous featured post"
            className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-900 hover:bg-white"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next featured post"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-900 hover:bg-white"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {articles.map((article, i) => (
              <button
                key={article.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to featured post ${i + 1}`}
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: i === index ? accentColour : "rgba(255,255,255,0.6)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
