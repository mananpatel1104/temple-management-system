import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

/**
 * Service-role Supabase client — used ONLY inside Edge Functions
 * (server-side, Deno runtime). The service-role key is read from an
 * Edge Function secret (`SUPABASE_SERVICE_ROLE_KEY`) that is never
 * bundled into the client PWA (MASTER_CONTEXT / Task 9 §6: "never
 * expose service-role credentials in client code").
 *
 * This client intentionally bypasses Row Level Security — see the RLS
 * comment block in supabase/migrations/0002_task9_auth_rbac_audit.sql
 * for the trust-boundary rationale (SDD 7.2/7.3).
 */
export function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY Edge Function secrets. ' +
        'Configure these via `supabase secrets set` before deploying (see docs/database).',
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
