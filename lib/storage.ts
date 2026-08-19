import type { Article } from "@/types";

const STORAGE_KEY = "blog-dashboard:articles";

export function loadStoredArticles(): Record<string, Article> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Article>;
  } catch {
    return {};
  }
}

export function saveArticle(article: Article): void {
  const all = loadStoredArticles();
  all[article.id] = article;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function getArticleWithEdits(id: string, fallback: Article): Article {
  const stored = loadStoredArticles();
  return stored[id] ?? fallback;
}
