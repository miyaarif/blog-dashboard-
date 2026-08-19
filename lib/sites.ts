import sitesData from "@/data/network-sites.json";
import articlesData from "@/data/network-articles.json";
import keywordsData from "@/data/network-keywords.json";
import type { Site, Article, Keyword } from "@/types";

export function getSites(): Site[] {
  return sitesData as Site[];
}

export function getArticles(): Article[] {
  return articlesData as Article[];
}

export function getKeywords(): Keyword[] {
  return keywordsData as Keyword[];
}

export function getSiteById(siteId: string): Site | undefined {
  return getSites().find((s) => s.id === siteId);
}

export function getArticlesBySite(siteId: string): Article[] {
  return getArticles().filter((a) => a.site_id === siteId);
}

export function getKeywordsBySite(siteId: string): Keyword[] {
  return getKeywords().filter((k) => k.site_id === siteId);
}

export function getUnassignedKeywords(): Keyword[] {
  return getKeywords().filter((k) => k.assigned_article_id === null);
}
