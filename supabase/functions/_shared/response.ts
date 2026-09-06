import { corsHeaders } from './cors.ts';

/**
 * Standard Response Envelope (SDD 6.2):
 *   Success: { success: true,  message, data }
 *   Error:   { success: false, message, error_code }
 */
export function jsonSuccess(
  data: unknown,
  message = 'OK',
  status = 200,
): Response {
  return new Response(
    JSON.stringify({ success: true, message, data }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

export type ErrorCode =
  | '400'
  | '401'
  | '403'
  | '404'
  | '409'
  | '423' // Locked (account lockout — not in SDD 6.4 table but standard HTTP semantics for FR-AUTH-009)
  | '500';

export function jsonError(
  message: string,
  errorCode: ErrorCode = '400',
  status?: number,
): Response {
  const httpStatus = status ?? Number(errorCode);
  return new Response(
    JSON.stringify({ success: false, message, error_code: errorCode }),
    {
      status: httpStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}
