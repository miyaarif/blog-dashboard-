import type { Article } from "@/types";

export interface CheckResult {
  passed: boolean;
  message: string;
}

export function runBaseChecks(article: Article): CheckResult[] {
  return [
    {
      passed: article.title.length >= 50 && article.title.length <= 60,
      message: "Title should be 50-60 characters",
    },
    {
      passed:
        article.meta_description.length >= 120 &&
        article.meta_description.length <= 158,
      message: "Meta description should be 120-158 characters",
    },
    {
      passed: article.word_count >= 800,
      message: "Article should be at least 800 words",
    },
    {
      passed: article.body_markdown.includes("## "),
      message: "Article should have at least one subheading",
    },
    {
      passed: article.slug.length > 0 && !article.slug.includes(" "),
      message: "Slug must exist and contain no spaces",
    },
    {
      passed: article.hero_image_url !== null,
      message: "Article should have a hero image",
    },
    {
      passed:
        article.hero_image_alt !== null && article.hero_image_alt.length > 0,
      message: "Hero image should have alt text",
    },
    {
      passed: article.internal_links.length >= 1,
      message: "Article should have at least one internal link",
    },
    {
      passed:
        article.target_keyword.length > 0 &&
        article.title
          .toLowerCase()
          .includes(article.target_keyword.toLowerCase()),
      message: "Title should include the target keyword",
    },
    {
      passed: article.author_name.length > 0,
      message: "Article should have an author name",
    },
  ];
}
