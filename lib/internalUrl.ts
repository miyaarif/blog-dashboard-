import { headers } from "next/headers";

// Server Components can't do a relative fetch() the way browser code can —
// Node requires an absolute URL. This reads the actual requested host so
// the review queue's server-side fetch to its own /api/ routes works the
// same in local dev and in any deployed environment.
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
