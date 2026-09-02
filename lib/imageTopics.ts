// Picks a Lucide icon name for a hero image based on the article's real
// title/target_keyword. Keyed on text patterns, not site_id — new sites
// inherit the same rules (matches CLAUDE.md's rubric-keying convention).

interface TopicRule {
  pattern: RegExp;
  icon: string;
}

// Order matters: first match wins. Specific topics before broad ones.
const TOPIC_RULES: TopicRule[] = [
  { pattern: /cosigner/, icon: "Users" },
  { pattern: /fafsa/, icon: "ClipboardList" },
  { pattern: /forbearance|deferment/, icon: "Clock" },
  { pattern: /plus loan/, icon: "Landmark" },
  { pattern: /refinanc/, icon: "TrendingUp" },
  { pattern: /interest rate|interest.*accru|capitalisation|capitalization/, icon: "Percent" },
  { pattern: /credit score/, icon: "Gauge" },
  { pattern: /international student/, icon: "GraduationCap" },
  { pattern: /student loan|graduate school|law student|engineering student|mba student|nursing student|medical student|part-time student|trade school|community college|online program/, icon: "GraduationCap" },
  { pattern: /factor rate|revenue.based financing|term loan|second.position/, icon: "PiggyBank" },
  { pattern: /equipment/, icon: "Wrench" },
  { pattern: /construction|trucking|landscaping|auto repair/, icon: "HardHat" },
  { pattern: /salon/, icon: "Scissors" },
  { pattern: /retail|e-commerce|ecommerce/, icon: "ShoppingCart" },
  { pattern: /hospitality|restaurant/, icon: "UtensilsCrossed" },
  { pattern: /dental/, icon: "Stethoscope" },
  { pattern: /remittance/, icon: "Receipt" },
  { pattern: /consolidat/, icon: "Landmark" },
  { pattern: /cash flow|fast.*funding|documents|qualify|imperfect credit|bad credit/, icon: "Zap" },
  { pattern: /sponsorship|affiliate|media kit|contract clause/, icon: "FileSignature" },
  { pattern: /ftc disclosure/, icon: "Shield" },
  { pattern: /roi|reporting|benchmark|cpm|rpm|high.intent traffic|paid reach/, icon: "BarChart3" },
  { pattern: /script structure|retention|comparison video/, icon: "Video" },
  { pattern: /outreach|email/, icon: "Mail" },
  { pattern: /seo keyword|youtube seo/, icon: "Search" },
  { pattern: /channel audit|vet a creator|content calendar/, icon: "Users" },
  { pattern: /thumbnail/, icon: "PlayCircle" },
  // Broad structural signal, checked after specific topics above.
  { pattern: /\bvs\.?\b|versus|compared/, icon: "Scale" },
];

const FALLBACK_ICON_BY_PROFILE: Record<string, string> = {
  ymyl_finance: "DollarSign",
  standard: "FileText",
};

export function pickIconName(
  title: string,
  targetKeyword: string,
  contentProfile: string,
): string {
  const haystack = `${title} ${targetKeyword}`.toLowerCase();

  for (const rule of TOPIC_RULES) {
    if (rule.pattern.test(haystack)) return rule.icon;
  }

  return FALLBACK_ICON_BY_PROFILE[contentProfile] ?? "FileText";
}
