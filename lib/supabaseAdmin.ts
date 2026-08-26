// SERVER-ONLY. Carries the service role key — bypasses RLS on every table.
// Never import this outside app/api/. Importing it from a client component
// would ship the service role key to the browser.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Lazy on purpose: Next.js imports this module at build time to collect
// route data. A module-level throw would fail the build even though the
// key is only needed once a request actually comes in.
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local, and to Vercel's Environment Variables for deployments.",
    );
  }

  client = createClient(supabaseUrl, serviceRoleKey);
  return client;
}
