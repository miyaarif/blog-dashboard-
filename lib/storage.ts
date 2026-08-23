import { supabase } from "@/lib/supabase";
import type { Article } from "@/types";

export async function saveArticle(article: Article): Promise<Article> {
  const { data, error } = await supabase
    .from("articles")
    .upsert(article, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as Article;
}
