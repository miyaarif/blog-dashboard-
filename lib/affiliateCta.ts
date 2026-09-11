// Manager feedback (Section 3): "Affiliate CTA blocks inserted from
// config where a lender is named." Real, config-driven, render-time
// only -- never written by the writer model, never stored in
// body_markdown, same principle as the compliance boilerplate (Fix 7)
// and the existing "Our choice" deal box.
//
// Placement: right after the H2/H3 section whose real heading text
// first names this brand. This is deterministic, not a guess -- every
// real per-brand body section (comparison, single_brand shapes) is
// required by the writer/outline rules to name that brand in its own
// heading (e.g. "## College Ave: built for repayment control...",
// "## Sallie Mae: the established name with..."), so a case-insensitive
// substring match on the brand's real name against section headings
// finds the right one.
//
// One CTA per brand, not one per matching heading: a real comparison
// article also has a "## Where College Ave falls short" section, which
// also contains the brand's name -- confirmed with a real test against
// art_0138. Assigning each brand to only its FIRST matching section
// (its own intro section, always earlier in the outline than the
// "falls short" follow-up) avoids a duplicate CTA under both.
export interface CtaBrand {
  id: string;
  name: string;
  affiliate_link: string | null;
  disclosure_text: string | null;
}

export interface AffiliateCta {
  brandName: string;
  ctaLink: string;
  disclosureText: string | null;
}

interface SectionLike {
  heading: string;
}

function isNonEmpty(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// Only a brand with a real, non-null affiliate_link ever produces a
// CTA -- both real brands (College Ave, Sallie Mae) have it null today,
// so this correctly assigns nothing for every real article right now.
// Starts working the moment a real link is entered, same as
// isCompleteDeal() in app/api/blog/data.ts.
export function assignAffiliateCtasToSections(
  sections: SectionLike[],
  brands: CtaBrand[],
): Map<number, AffiliateCta> {
  const assignments = new Map<number, AffiliateCta>();

  for (const brand of brands) {
    if (!isNonEmpty(brand.affiliate_link)) continue;

    const sectionIndex = sections.findIndex((s) =>
      s.heading.toLowerCase().includes(brand.name.toLowerCase()),
    );
    if (sectionIndex === -1) continue;

    // If two brands' names both first-match the same section (not seen
    // in any real data, but not impossible), keep whichever was
    // assigned first rather than overwrite it.
    if (assignments.has(sectionIndex)) continue;

    assignments.set(sectionIndex, {
      brandName: brand.name,
      ctaLink: brand.affiliate_link,
      disclosureText: isNonEmpty(brand.disclosure_text) ? brand.disclosure_text : null,
    });
  }

  return assignments;
}
