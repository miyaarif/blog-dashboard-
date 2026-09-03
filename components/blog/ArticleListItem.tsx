import Link from "next/link";
import HeroImage from "@/components/HeroImage";
import { deriveExcerpt } from "@/lib/blogContent";
import type { Article } from "@/types";

export default function ArticleListItem({ article }: { article: Article }) {
  const excerpt = deriveExcerpt(article.body_markdown, 150);

  return (
    <article className="flex gap-4 border-b border-gray-200 py-6 first:pt-0 last:border-b-0">
      <Link
        href={`/blog/${article.slug}`}
        className="block w-40 shrink-0 sm:w-48"
      >
        <HeroImage
          src={article.hero_image_url}
          alt={article.hero_image_alt ?? ""}
          className="aspect-[1200/630] w-full rounded-md object-cover"
          fallbackClassName="aspect-[1200/630] w-full rounded-md bg-gray-100"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold text-gray-900">
          <Link href={`/blog/${article.slug}`} className="hover:underline">
            {article.title}
          </Link>
        </h3>
        <p className="mt-1.5 text-sm text-gray-600">
          {excerpt}{" "}
          <Link
            href={`/blog/${article.slug}`}
            className="font-medium text-gray-900 hover:underline"
          >
            Read more
          </Link>
        </p>
      </div>
    </article>
  );
}
