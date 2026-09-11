import { BrandRow, ContentShape } from "./pipelineShared";

// ------------------------------------------------------------
// Deterministic skeleton -- which named sections exist, in what order,
// for each content_shape. This is the exact branching already hardcoded
// in the active writer prompt's "STRUCTURE FOR THIS CONTENT SHAPE"
// block, pulled out into its own reusable function. No AI call: given
// the same content_shape and brand list, this always returns the same
// skeleton -- content_shape already determines it.
// ------------------------------------------------------------
export type OutlineSectionRole =
  | "quick_answer"
  | "key_takeaways"
  | "body"
  | "faq";

export interface OutlineSkeletonSlot {
  slot_id: string;
  role: OutlineSectionRole;
  // Exact heading text the writer must use verbatim, when the shape
  // requires it (rule 11: "Key takeaways" and "FAQ" aren't a
  // conversational rewrite). null means the AI-population call proposes
  // real heading text, which the writer may still re-word for site
  // heading style/case.
  fixed_heading: string | null;
  instructions: string;
}

export function buildOutlineSkeleton(
  contentShape: ContentShape,
  brands: BrandRow[],
): OutlineSkeletonSlot[] {
  const slots: OutlineSkeletonSlot[] = [
    {
      slot_id: "quick_answer",
      role: "quick_answer",
      fixed_heading: null,
      instructions:
        "2-4 sentences (or a short numbered list, if the title asks \"how to\" do something) that directly answers the reader's core question. No heading -- reads as the article's opening.",
    },
    {
      slot_id: "key_takeaways",
      role: "key_takeaways",
      fixed_heading: "## Key takeaways",
      instructions:
        "A bullet list sized to how many real, distinct points this specific topic actually supports (usually 3-6, never padded to a round number). Every takeaway must also be explained in full in a body section below -- never introduced only here.",
    },
  ];

  if (contentShape === "comparison") {
    for (const brand of brands) {
      slots.push({
        slot_id: `brand_${brand.id}`,
        role: "body",
        fixed_heading: null,
        instructions: `Cover ${brand.name}'s real fit, strengths, and its real weakness -- from VERIFIED BRAND FACTS only. An article where this brand has no downside is an advertisement.`,
      });
    }
    slots.push({
      slot_id: "head_to_head",
      role: "body",
      fixed_heading: null,
      instructions:
        "Head-to-head comparison across the brands above -- the real, concrete differences that actually matter to a reader choosing between them.",
    });
    slots.push({
      slot_id: "recommendation",
      role: "body",
      fixed_heading: null,
      instructions:
        "Name which real brand fits which real reader situation, and why. Every compared brand's real weakness must be named somewhere in the article (not necessarily here again).",
    });
  } else if (contentShape === "single_brand") {
    const brand = brands[0];
    slots.push({
      slot_id: `brand_${brand?.id ?? "single"}`,
      role: "body",
      fixed_heading: null,
      instructions: `Cover ${brand?.name ?? "the brand"}'s real fit, its real strengths, and its real weakness. No "vs" framing and no comparison to a brand that wasn't supplied.`,
    });
  } else if (contentShape === "buying_guide") {
    slots.push({
      slot_id: "decision_criteria",
      role: "body",
      fixed_heading: null,
      instructions:
        "No specific company can be named (rule 15). Decision-support structure -- the real criteria a reader should weigh, in the order that actually matters, broken into as many distinct sections as this topic genuinely supports. Decide the real count -- don't force a fixed number. The 'recommendation' this shape owes the reader is a concrete decision process, not a product pick. Never hedge into \"we can't tell you which one to choose.\"",
    });
  } else {
    slots.push({
      slot_id: "explainer_body",
      role: "body",
      fixed_heading: null,
      instructions:
        "No comparison section and no recommendation section at all. Direct explainer sections that answer the reader's real question, in the order they would naturally ask it. Decide the real number of sections this topic needs.",
    });
  }

  slots.push({
    slot_id: "faq",
    role: "faq",
    fixed_heading: "## FAQ",
    instructions:
      "Only as many real question-and-answer pairs as this topic genuinely raises (usually 3-6, driven by real reader questions about this specific subject, not a fixed count).",
  });

  return slots;
}

export function formatOutlineSkeletonForPrompt(
  skeleton: OutlineSkeletonSlot[],
): string {
  return skeleton
    .map((slot, i) => {
      const headingNote = slot.fixed_heading
        ? `Required heading (use exactly): ${slot.fixed_heading}`
        : "Heading: propose real wording -- the writer may still adjust it to match site heading style/case.";
      return `${i + 1}. [${slot.role}] ${headingNote}\n   Must cover: ${slot.instructions}`;
    })
    .join("\n\n");
}

// ------------------------------------------------------------
// AI-populated outline -- the skeleton above, filled in with this
// specific assignment's real facts.
// ------------------------------------------------------------
export interface OutlineSection {
  heading: string;
  role: OutlineSectionRole;
  purpose: string;
  key_points: string[];
}

export interface PopulatedOutline {
  sections: OutlineSection[];
  takeaway_count: number;
  faq_topics: string[];
}

export function isPopulatedOutline(value: unknown): value is PopulatedOutline {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  if (!Array.isArray(v.sections) || v.sections.length === 0) return false;
  const sectionsOk = v.sections.every((s) => {
    if (typeof s !== "object" || s === null) return false;
    const sec = s as Record<string, unknown>;
    return (
      typeof sec.heading === "string" &&
      typeof sec.role === "string" &&
      typeof sec.purpose === "string" &&
      Array.isArray(sec.key_points) &&
      sec.key_points.every((k) => typeof k === "string")
    );
  });
  if (!sectionsOk) return false;

  if (typeof v.takeaway_count !== "number") return false;
  if (
    !Array.isArray(v.faq_topics) ||
    !v.faq_topics.every((f) => typeof f === "string")
  )
    return false;

  return true;
}

export function formatOutlineForPrompt(outline: PopulatedOutline): string {
  const sectionText = outline.sections
    .map((s, i) => {
      const points =
        s.key_points.length > 0
          ? s.key_points.map((p) => `   - ${p}`).join("\n")
          : "   - (no specific points given -- use judgement within this section's purpose)";
      return `${i + 1}. ${s.heading}\n   Purpose: ${s.purpose}\n${points}`;
    })
    .join("\n\n");

  const faqText = outline.faq_topics.map((t) => `- ${t}`).join("\n");

  return (
    `${sectionText}\n\n` +
    `Key takeaways: write exactly ${outline.takeaway_count} real, distinct takeaways -- no more, no fewer.\n\n` +
    `FAQ topics to cover, one real question-and-answer pair per topic:\n${faqText}`
  );
}
