// ------------------------------------------------------------
// Fix 4 (manager feedback) — research stage.
// Runs once per article, before attempt 1. Builds a few real search
// queries, then calls an n8n workflow that runs the actual SerpAPI
// search + Firecrawl extraction with its own stored credentials
// (SerpAPI/Firecrawl keys live in n8n only — n8n credentials are
// write-only, so this app can never hold or read those keys itself).
// The raw results come back over the webhook response; filtering,
// capping, truncating, and formatting into a fact sheet all happen
// here, in versioned code, not inside the n8n workflow.
//
// Deliberately no AI call in this file: query construction and source
// selection are plain rules, and the fact sheet is the real extracted
// text, not a model's summary of it. For YMYL content we want the
// writer citing what a real page actually said, not a second model's
// paraphrase of it.
// ------------------------------------------------------------
import { Agent, fetch as undiciFetch } from "undici";
import { ContentShape } from "@/lib/pipelineShared";
import { BrandRow } from "@/lib/pipelineShared";

export interface ResearchSource {
  url: string;
  title: string;
  snippet: string;
  fetched_at: string;
  extract_excerpt: string;
}

export interface ResearchResult {
  queries: string[];
  sources: ResearchSource[];
  factSheet: string;
}

// Low-signal for citing a real, dated fact — forums and social feeds,
// not the kind of source a grader should accept as a verified figure.
const BLOCKED_DOMAINS = [
  "reddit.com",
  "quora.com",
  "pinterest.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
];

const MAX_SOURCES_TOTAL = 6;
const EXTRACT_MAX_CHARS = 4000;

// Research has to finish before the writer can start, so this is a
// real synchronous wait, not fire-and-forget like notifyN8n. n8n runs
// up to ~3 SerpAPI searches and ~9 Firecrawl scrapes sequentially
// inside one workflow before responding, which can plausibly run
// close to undici's default 300s headersTimeout/bodyTimeout — the
// same failure mode already documented and fixed in
// app/api/loop-trigger/route.ts ("fetch failed" at ~304s even though
// the real work kept running server-side). Same fix here: a dedicated
// Agent with a very high ceiling, with our own AbortController as the
// real, intentional timeout.
const RESEARCH_WEBHOOK_TIMEOUT_MS = 300_000;
const RESEARCH_WEBHOOK_DISPATCHER = new Agent({
  headersTimeout: 3_600_000,
  bodyTimeout: 3_600_000,
});

function isBlockedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return true; // an unparseable URL isn't a usable source either
  }
}

// Deterministic — no model call decides these. A general query always
// runs; comparison/single_brand add one query per named brand (capped
// at 2, matching the real data where comparisons are always 2 brands).
//
// The brand-query branch takes `vertical` (sites.vertical), not
// content_profile -- checked real data first: site_scholar and
// site_fuel share content_profile "ymyl_finance" but have genuinely
// different verticals ("Student Lending" vs "Small Business
// Financing"), so a content_profile-keyed phrase would still have been
// wrong for Fuel. vertical is already threaded elsewhere in the
// pipeline as {{vertical}}, same site-level field, no new mechanism.
export function buildResearchQueries(
  targetKeyword: string,
  contentShape: ContentShape,
  brands: BrandRow[],
  vertical: string,
): string[] {
  const queries = [targetKeyword];

  if (contentShape === "comparison" || contentShape === "single_brand") {
    for (const brand of brands.slice(0, 2)) {
      queries.push(`${brand.name} ${vertical} rates terms`);
    }
  } else {
    queries.push(`${targetKeyword} 2026`);
  }

  return queries;
}

// One raw search-result-plus-scrape from the n8n workflow. n8n runs
// SerpAPI for each query, then Firecrawl for each of that query's top
// results, and returns the flat list — no filtering or capping done
// on the n8n side, so that logic stays here, versioned, not hand-built
// inside the workflow.
interface N8nResearchResultItem {
  query: string;
  url: string;
  title?: string;
  snippet?: string;
  markdown?: string;
  scrape_ok: boolean;
}

interface N8nResearchResponse {
  results: N8nResearchResultItem[];
}

export async function callN8nResearchWebhook(
  webhookUrl: string,
  webhookSecret: string | undefined,
  articleId: string,
  queries: string[],
): Promise<N8nResearchResultItem[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (webhookSecret) headers["x-webhook-secret"] = webhookSecret;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    RESEARCH_WEBHOOK_TIMEOUT_MS,
  );

  try {
    const res = await undiciFetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ article_id: articleId, queries }),
      signal: controller.signal,
      dispatcher: RESEARCH_WEBHOOK_DISPATCHER,
    });
    if (!res.ok) {
      throw new Error(`n8n research webhook returned ${res.status}`);
    }
    const data = (await res.json()) as N8nResearchResponse;
    return data.results ?? [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export function formatFactSheet(sources: ResearchSource[]): string {
  if (sources.length === 0) {
    return "No research sources were found for this assignment. Do not state any figure, rate, or statistic that isn't already in VERIFIED BRAND FACTS.";
  }

  return sources
    .map(
      (s, i) =>
        `${i + 1}. ${s.title} — ${s.url} (fetched ${s.fetched_at})\n` +
        `   Snippet: ${s.snippet}\n` +
        `   Extract: ${s.extract_excerpt}`,
    )
    .join("\n\n");
}

// Real queries -> n8n runs the credentialed search+scrape -> filter,
// dedupe, cap, and truncate here -> a dated fact sheet. A per-source
// scrape failure is expected and skipped, not fatal (n8n marks it
// scrape_ok=false). The whole call throwing (n8n down, misconfigured,
// timed out) is not swallowed here — the caller treats that as a real
// pipeline error, same as a DeepSeek call failing, rather than silently
// proceeding with no facts.
export async function runResearchStage(
  webhookUrl: string,
  webhookSecret: string | undefined,
  articleId: string,
  targetKeyword: string,
  contentShape: ContentShape,
  brands: BrandRow[],
  vertical: string,
): Promise<ResearchResult> {
  const queries = buildResearchQueries(targetKeyword, contentShape, brands, vertical);
  const fetchedAt = new Date().toISOString().slice(0, 10);

  const rawResults = await callN8nResearchWebhook(
    webhookUrl,
    webhookSecret,
    articleId,
    queries,
  );

  const seenUrls = new Set<string>();
  const sources: ResearchSource[] = [];

  for (const r of rawResults) {
    if (!r.scrape_ok || !r.url || !r.markdown) continue;
    if (seenUrls.has(r.url) || isBlockedDomain(r.url)) continue;
    seenUrls.add(r.url);
    sources.push({
      url: r.url,
      title: r.title ?? r.url,
      snippet: r.snippet ?? "",
      fetched_at: fetchedAt,
      extract_excerpt: r.markdown.slice(0, EXTRACT_MAX_CHARS),
    });
    if (sources.length >= MAX_SOURCES_TOTAL) break;
  }

  return { queries, sources, factSheet: formatFactSheet(sources) };
}
