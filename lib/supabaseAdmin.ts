// SERVER-ONLY. Carries the service role key — bypasses RLS on every table.
// Never import this outside app/api/. Importing it from a client component
// would ship the service role key to the browser.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local.",
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
