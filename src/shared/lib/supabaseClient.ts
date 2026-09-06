import { createClient } from '@supabase/supabase-js';
import { env } from '@config/env';

/**
 * Single shared Supabase client for the whole application.
 *
 * IMPORTANT — per MASTER_CONTEXT / SRS Chapter 6 & SDD 7.1:
 * This project uses a custom PIN-based authentication model, NOT Supabase
 * Auth. `auth.persistSession` and `auth.autoRefreshToken` are disabled so
 * the Supabase Auth subsystem is never engaged. Editor session tokens are
 * managed entirely by the application's own auth module (SDD 4.1
 * SessionStore) and attached manually where required.
 *
 * Credentials come exclusively from environment variables (see
 * src/config/env.ts) — never hard-code project URLs or keys here.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-application-name': env.appName,
    },
  },
});
