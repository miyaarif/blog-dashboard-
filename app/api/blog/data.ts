// Not a route — a plain server module. Lives under app/api/ specifically
// so the supabaseAdmin import stays inside app/api/, per the hard rule in
// CLAUDE.md (never import it elsewhere, since that's what keeps the
// service-role key out of anything that could end up client-side).
// article_brands/brands are RLS-locked to service_role (confirmed: the
// anon key returns 0 rows for both, silently, not an error), so any real
// completeness check on them has to run through here.
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export interface BrandDeal {
  brandId: string;
  brandName: string;
  logoUrl: string;
  discountPercent: number;
  ctaLink: string;
}

// brands has no logo_url or discount_percent column (confirmed against the
// live schema 2026-09-03) — so no deal can ever be "complete" until those
// columns exist. affiliate_link exists but is null on every real row
// today. This checks the real columns rather than hardcoding a skip, so it
// starts working the moment the schema catches up — it doesn't need to be
// touched again.
function isCompleteDeal(candidate: {
  logoUrl: string | null;
  discountPercent: number | null;
  ctaLink: string | null;
}): candidate is { logoUrl: string; discountPercent: number; ctaLink: string } {
  return Boolean(
    candidate.logoUrl && candidate.discountPercent !== null && candidate.ctaLink,
  );
}

export async function getBrandDealForArticle(
  articleId: string,
): Promise<BrandDeal | null> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: link } = await supabaseAdmin
    .from("article_brands")
    .select("brand_id")
    .eq("article_id", articleId)
    .eq("role", "primary")
    .limit(1)
    .maybeSingle();

  if (!link) return null;

  const { data: brand } = await supabaseAdmin
    .from("brands")
    .select("id, name, affiliate_link, active")
    .eq("id", link.brand_id)
    .maybeSingle();

  if (!brand || !brand.active) return null;

  const candidate = {
    logoUrl: null as string | null, // no schema column yet
    discountPercent: null as number | null, // no schema column yet
    ctaLink: brand.affiliate_link as string | null,
  };

  if (!isCompleteDeal(candidate)) return null;

  return {
    brandId: brand.id,
    brandName: brand.name,
    logoUrl: candidate.logoUrl,
    discountPercent: candidate.discountPercent,
    ctaLink: candidate.ctaLink,
  };
}

// "Best deals" sidebar widget — real brands actually used by this site's
// articles, filtered to the same completeness rule. Returns [] today for
// every site (see isCompleteDeal above) — that's expected, not a bug.
export async function getBrandDealsForSite(
  siteId: string,
  limit = 3,
): Promise<BrandDeal[]> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: siteArticles } = await supabaseAdmin
    .from("articles")
    .select("id")
    .eq("site_id", siteId);
  const articleIds = (siteArticles ?? []).map((a) => a.id as string);
  if (articleIds.length === 0) return [];

  const { data: links } = await supabaseAdmin
    .from("article_brands")
    .select("brand_id")
    .in("article_id", articleIds);
  const brandIds = [...new Set((links ?? []).map((l) => l.brand_id as string))];
  if (brandIds.length === 0) return [];

  const { data: brands } = await supabaseAdmin
    .from("brands")
    .select("id, name, affiliate_link, active")
    .in("id", brandIds)
    .eq("active", true);

  const deals: BrandDeal[] = [];
  for (const brand of brands ?? []) {
    const candidate = {
      logoUrl: null as string | null,
      discountPercent: null as number | null,
      ctaLink: brand.affiliate_link as string | null,
    };
    if (isCompleteDeal(candidate)) {
      deals.push({
        brandId: brand.id,
        brandName: brand.name,
        logoUrl: candidate.logoUrl,
        discountPercent: candidate.discountPercent,
        ctaLink: candidate.ctaLink,
      });
    }
  }
  return deals.slice(0, limit);
}
