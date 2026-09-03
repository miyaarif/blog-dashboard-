import { Caveat } from "next/font/google";

// Google Font, SIL Open Font License (free) — self-hosted by Next.js at
// build time, no external request at runtime. Used only for the calendar
// poster's month name, per the two-typeface system (script + existing
// system sans) — not applied anywhere else in the app.
export const caveat = Caveat({
  subsets: ["latin"],
  weight: ["700"],
});
