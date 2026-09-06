import { env } from '@config/env';

/**
 * Thin client for calling this project's Supabase Edge Functions
 * (supabase/functions/*), which are the "Application/API Tier" in SDD
 * 2.2. Every function returns the standard envelope defined in SDD 6.2:
 *   Success: { success: true,  message, data }
 *   Error:   { success: false, message, error_code }
 *
 * Deliberately separate from `supabase` (src/shared/lib/supabaseClient.ts):
 * that client talks to PostgREST directly (unused for anything
 * privileged, since RLS denies the anon key by design — see the Task 9
 * migration); this one talks to the Edge Functions that hold the
 * service-role key server-side.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data?: T;
  error_code?: string;
}

function functionUrl(name: string): string {
  // Supabase Edge Functions are served from
  // https://<project-ref>.supabase.co/functions/v1/<name>
  const base = env.supabaseUrl.replace(/\/+$/, '');
  return `${base}/functions/v1/${name}`;
}

async function callFunction<T>(
  name: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    sessionToken?: string | null;
    query?: Record<string, string | undefined>;
  } = {},
): Promise<T> {
  const { method = 'POST', body, sessionToken, query } = options;

  let url = functionUrl(name);
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, value);
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // The Supabase Edge Function gateway itself expects the anon key as
    // apikey/Authorization for routing UNLESS a Bearer editor session
    // token is present, in which case that token is what our own RBAC
    // layer inside the function reads via requireEditorSession().
    apikey: env.supabaseAnonKey,
    Authorization: `Bearer ${sessionToken ?? env.supabaseAnonKey}`,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Unable to reach the server. Please check your internet connection.',
      'NETWORK',
      0,
    );
  }

  let envelope: Envelope<T>;
  try {
    envelope = await response.json();
  } catch {
    throw new ApiError('Unexpected server response.', 'PARSE', response.status);
  }

  if (!envelope.success) {
    throw new ApiError(
      envelope.message || 'Request failed.',
      envelope.error_code ?? String(response.status),
      response.status,
    );
  }

  return envelope.data as T;
}

export const functionsClient = {
  get: <T>(name: string, query?: Record<string, string | undefined>, sessionToken?: string | null) =>
    callFunction<T>(name, { method: 'GET', query, sessionToken }),
  post: <T>(name: string, body?: unknown, sessionToken?: string | null) =>
    callFunction<T>(name, { method: 'POST', body, sessionToken }),
  put: <T>(name: string, body?: unknown, sessionToken?: string | null) =>
    callFunction<T>(name, { method: 'PUT', body, sessionToken }),
};
