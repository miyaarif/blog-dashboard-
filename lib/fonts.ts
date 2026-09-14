import { Caveat, EB_Garamond } from "next/font/google";

// Google Font, SIL Open Font License (free) — self-hosted by Next.js at
// build time, no external request at runtime. Used only for the calendar
// poster's month name, per the two-typeface system (script + existing
// system sans) — not applied anywhere else in the app.
export const caveat = Caveat({
  subsets: ["latin"],
  weight: ["700"],
});

// Editorial serif for the article detail page (headline, dek, section
// headings, body) — deliberately separate from the dashboard's sans-serif
// UI chrome so article content reads like a published piece, not app
// chrome. Self-hosted via next/font (same mechanism as Caveat above)
// rather than the Google Fonts CSS2 <link> — identical fonts and weights,
// no external request at runtime.
export const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});
