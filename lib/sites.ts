import { supabase } from "@/lib/supabase";
import type { Site, Article, Keyword } from "@/types";

export async function getSites(): Promise<Site[]> {
  const { data, error } = await supabase.from("sites").select("*");
  if (error) throw error;
  return data as Site[];
}

export async function getArticles(): Promise<Article[]> {
  const { data, error } = await supabase.from("articles").select("*");
  if (error) throw error;
  return data as Article[];
}

export async function getKeywords(): Promise<Keyword[]> {
  const { data, error } = await supabase.from("keywords").select("*");
  if (error) throw error;
  return data as Keyword[];
}

export async function getSiteById(siteId: string): Promise<Site | undefined> {
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw error;
  return (data as Site) ?? undefined;
}

export async function getArticleById(
  id: string,
): Promise<Article | undefined> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Article) ?? undefined;
}

export async function getArticlesBySite(siteId: string): Promise<Article[]> {
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("site_id", siteId);
  if (error) throw error;
  return data as Article[];
}

export async function getKeywordsBySite(siteId: string): Promise<Keyword[]> {
  const { data, error } = await supabase
    .from("keywords")
    .select("*")
    .eq("site_id", siteId);
  if (error) throw error;
  return data as Keyword[];
}

export async function getUnassignedKeywords(): Promise<Keyword[]> {
  const { data, error } = await supabase
    .from("keywords")
    .select("*")
    .is("assigned_article_id", null);
  if (error) throw error;
  return data as Keyword[];
}
