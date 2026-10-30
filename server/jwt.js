import crypto from 'node:crypto';

/**
 * Minimal JWT handling — enough for the OIDC implicit flow.
 *
 * Null's Connect returns `response_type=id_token`, so the credential arrives
 * as a signed JWT in the URL fragment rather than an authorization code.
 * In `connect` mode we verify RS256 against the provider's JWKS; in `mock`
 * mode the bundled dev provider signs HS256 with the session secret.
 */

const b64urlDecode = (input) => Buffer.from(input, 'base64url');
const b64urlEncode = (buf) => Buffer.from(buf).toString('base64url');

export function decodeJwt(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  // Only the first two segments are JSON; the third is a raw signature.
  const header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
  const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  return { header, payload, signature: parts[2], signingInput: `${parts[0]}.${parts[1]}` };
}

export function signHs256(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const signingInput = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(payload))}`;
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

export function verifyHs256(token, secret) {
  const { header, payload, signature, signingInput } = decodeJwt(token);
  if (header.alg !== 'HS256') throw new Error(`unexpected alg: ${header.alg}`);
  const expected = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('bad signature');
  return payload;
}

/* ------------------------------------------------------------------ *
 * RS256 against a remote JWKS
 * ------------------------------------------------------------------ */

let jwksCache = { keys: null, fetchedAt: 0 };

async function fetchJwks(url) {
  const maxAge = 10 * 60 * 1000;
  if (jwksCache.keys && Date.now() - jwksCache.fetchedAt < maxAge) return jwksCache.keys;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`jwks fetch failed: HTTP ${response.status}`);
  const body = await response.json();
  jwksCache = { keys: body.keys || [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

export async function verifyRs256(token, { jwksUrl, issuer, audience }) {
  const { header, payload, signature, signingInput } = decodeJwt(token);
  if (header.alg !== 'RS256') throw new Error(`unexpected alg: ${header.alg}`);

  const keys = await fetchJwks(jwksUrl);
  const jwk = keys.find((k) => k.kid === header.kid) || keys.find((k) => k.kty === 'RSA');
  if (!jwk) throw new Error('no matching key in jwks');

  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const ok = crypto
    .createVerify('RSA-SHA256')
    .update(signingInput)
    .verify(key, b64urlDecode(signature));
  if (!ok) throw new Error('bad signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('token expired');
  if (payload.iat && payload.iat > now + 60) throw new Error('token issued in the future');
  if (issuer && payload.iss !== issuer) throw new Error(`unexpected issuer: ${payload.iss}`);
  if (audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(audience)) throw new Error(`unexpected audience: ${payload.aud}`);
  }
  return payload;
}
