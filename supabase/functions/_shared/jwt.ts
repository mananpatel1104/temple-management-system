/**
 * Minimal HS256 JWT implementation using the Web Crypto API (available
 * natively in the Deno Edge Function runtime — no external dependency
 * needed). Used exclusively for short-lived EDITOR session tokens
 * (SDD 7.1: "a short-lived signed session token (e.g., JWT, 10–15
 * minute expiry per SEC-003) is issued on successful login").
 *
 * This is intentionally NOT Supabase Auth (MASTER_CONTEXT: "Do NOT use
 * Supabase Auth") — it is the application's own SessionStore token
 * (SDD 4.1 Table 3 "SessionStore").
 */

const SESSION_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes — SEC-003 upper bound

export interface SessionClaims {
  sub: string; // member_id
  role: string; // role_key
  name: string; // full_name, for audit convenience
  iat: number;
  exp: number;
}

function getSecretKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('AUTH_JWT_SECRET');
  if (!secret || secret.length < 16) {
    throw new Error(
      'Missing/weak AUTH_JWT_SECRET Edge Function secret. Configure a strong random ' +
        'value via `supabase secrets set AUTH_JWT_SECRET=...` before deploying.',
    );
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function issueSessionToken(params: {
  memberId: string;
  roleKey: string;
  fullName: string;
}): Promise<{ token: string; expiresAt: string }> {
  const key = await getSecretKey();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    sub: params.memberId,
    role: params.roleKey,
    name: params.fullName,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TOKEN_TTL_SECONDS,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerPart = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const payloadPart = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(claims)),
  );
  const signingInput = `${headerPart}.${payloadPart}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput),
  );
  const signaturePart = base64UrlEncode(new Uint8Array(signature));

  return {
    token: `${signingInput}.${signaturePart}`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

export async function verifySessionToken(
  token: string,
): Promise<SessionClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;

  try {
    const key = await getSecretKey();
    const signingInput = `${headerPart}.${payloadPart}`;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signaturePart!),
      new TextEncoder().encode(signingInput),
    );
    if (!valid) return null;

    const claims = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadPart!)),
    ) as SessionClaims;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp < nowSeconds) return null;
    if (!claims.sub || !claims.role) return null;

    return claims;
  } catch {
    return null;
  }
}

/** Extracts and verifies the Bearer session token from a Request, or null. */
export async function resolveSession(
  req: Request,
): Promise<SessionClaims | null> {
  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  return verifySessionToken(match[1]!);
}
