/**
 * Shared CORS headers for every Edge Function (SDD 6.1 "CORS / HTTPS
 * enforcement" pipeline step). The PWA is served from GitHub Pages on a
 * different origin than the Supabase project, so every response —
 * including error responses and the OPTIONS preflight — must carry
 * these headers.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
