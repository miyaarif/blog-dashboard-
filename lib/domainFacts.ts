// ------------------------------------------------------------
// Fix 5 (manager feedback) — curated verified-facts mechanism.
// Corrects specific, real hallucinations found in production (the
// cosigner/co-borrower conflation, the grace-period hedge, the PLUS
// loan deferment mix-up, the rate-shopping-window misattribution) by
// giving the writer/reviser/grader the human-verified truth directly,
// instead of relying on general knowledge or the research stage (which
// is tuned for current market figures, not fixed regulatory facts —
// tested for real: it reliably surfaces the grace-period length but
// not the cosigner/co-borrower distinction).
//
// Keyed on `vertical`, not content_profile or site_id — see the real
// data check in the 20260910_domain_facts.sql migration comment.
// ------------------------------------------------------------
import { SupabaseClient } from "@supabase/supabase-js";

export interface DomainFact {
  claim: string;
  correct_fact: string;
  confidence: "sourced" | "verified_assertion";
  source: string | null;
}

export async function getDomainFacts(
  supabaseAdmin: SupabaseClient,
  vertical: string,
): Promise<DomainFact[]> {
  if (!vertical) return [];

  const { data, error } = await supabaseAdmin
    .from("domain_facts")
    .select("claim,correct_fact,confidence,source")
    .eq("vertical", vertical);

  if (error) {
    throw new Error(`Could not load domain facts: ${error.message}`);
  }
  return (data ?? []) as DomainFact[];
}

export function formatDomainFacts(facts: DomainFact[]): string {
  if (facts.length === 0) {
    return "No curated domain facts recorded for this vertical.";
  }

  return facts
    .map((f, i) => {
      const provenance =
        f.confidence === "sourced"
          ? `Source: ${f.source ?? "(recorded as sourced but no source text set — treat as verified_assertion until fixed)"}`
          : "Confidence: verified assertion — real and verified through converging evidence, but with no single clean citable source. State it plainly; do not invent a citation for it.";
      return (
        `${i + 1}. Common wrong claim: "${f.claim}"\n` +
        `   Correct fact: ${f.correct_fact}\n` +
        `   ${provenance}`
      );
    })
    .join("\n\n");
}
