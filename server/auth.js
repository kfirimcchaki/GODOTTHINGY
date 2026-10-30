import crypto from 'node:crypto';
import config from './config.js';
import db, { persist } from './db.js';
import { sessionToken } from './ids.js';
import { signHs256, verifyHs256, verifyRs256 } from './jwt.js';

/* ------------------------------------------------------------------ *
 * Sessions — opaque tokens in an HttpOnly cookie.
 * ------------------------------------------------------------------ */

export function createSession(userId) {
  const token = sessionToken();
  db.sessions.push({
    token,
    user_id: userId,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + config.session.ttlMs).toISOString(),
  });
  persist();
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const session = db.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (Date.parse(session.expires_at) < Date.now()) return null;
  return db.users.find((u) => u.user_id === session.user_id) || null;
}

export function destroySession(token) {
  const idx = db.sessions.findIndex((s) => s.token === token);
  if (idx >= 0) {
    db.sessions.splice(idx, 1);
    persist();
  }
}

/* ------------------------------------------------------------------ *
 * Cookie helpers
 * ------------------------------------------------------------------ */

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (key) out[key] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function sessionCookie(token, { maxAge } = {}) {
  const bits = [
    `${config.session.cookie}=${token ? encodeURIComponent(token) : ''}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    maxAge === undefined ? `Max-Age=${Math.floor(config.session.ttlMs / 1000)}` : `Max-Age=${maxAge}`,
  ];
  return bits.join('; ');
}

/* ------------------------------------------------------------------ *
 * OAuth — "Null's Connect", OIDC implicit flow
 *
 * The live site redirects to
 *   https://connect.nulls.gg/authorize?scope=openid+email
 *     &response_type=id_token&redirect_uri=<site>/connect?return_to=<path>
 *     &client_id=9#sign_up
 * and receives a signed id_token in the URL fragment. Because fragments are
 * never sent to a server, /connect is handled client-side: the SPA posts the
 * id_token to POST /api/auth/session, which verifies it here.
 *
 * In `mock` mode the bundled dev provider mints an HS256 id_token so the
 * round trip works locally without third-party credentials.
 * ------------------------------------------------------------------ */

export function redirectUri(req) {
  if (config.auth.redirectUri) return config.auth.redirectUri;
  const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
  return `${base}/connect`;
}

/** Absolute authorize URL, matching the live parameter set and ordering. */
export function authorizeUrl(req, returnTo) {
  const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
  const callback = config.auth.redirectUri || `${base}/connect?return_to=${encodeURIComponent(returnTo || '/')}`;
  const params = new URLSearchParams({
    scope: config.auth.scope,
    response_type: config.auth.responseType,
    redirect_uri: callback,
    client_id: config.auth.clientId,
  });
  if (config.auth.mode === 'mock') {
    return `/dev/connect/authorize?${params}`;
  }
  // The provider appends its own `#sign_up` fragment to open on the sign-up tab.
  return `${config.auth.authorizeUrl}?${params}#sign_up`;
}

/** Verify an id_token and return a normalised profile. */
export async function verifyIdToken(idToken) {
  if (config.auth.mode === 'mock') {
    const payload = verifyHs256(idToken, config.session.secret);
    return profileFromClaims(payload);
  }
  const payload = await verifyRs256(idToken, {
    jwksUrl: config.auth.jwksUrl,
    issuer: config.auth.issuer,
    audience: config.auth.audience,
  });
  return profileFromClaims(payload);
}

function profileFromClaims(claims) {
  const name = claims.name || claims.nickname || claims.preferred_username || claims.email || 'Player';
  const username = (claims.preferred_username || claims.nickname || claims.email || name)
    .toString()
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '');
  return {
    user_id: claims.sub || uuidFrom(String(name)),
    name: String(name),
    username,
    email: claims.email ?? null,
    avatar_url: claims.picture ?? null,
    is_beta: Boolean(claims.is_beta ?? claims.beta ?? false),
  };
}

function uuidFrom(seed) {
  return crypto
    .createHash('sha1')
    .update(seed)
    .digest('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5');
}

/* ------------------------------------------------------------------ *
 * Built-in development identity provider
 * ------------------------------------------------------------------ */

const MOCK_PROFILES = {
  beta: { name: 'Beta Tester', username: 'betatester', email: 'beta@example.test', is_beta: true },
  guest: { name: 'Guest Player', username: 'guestplayer', email: 'guest@example.test', is_beta: false },
};

export function mockIdToken(account) {
  const profile = MOCK_PROFILES[account] || MOCK_PROFILES.beta;
  const now = Math.floor(Date.now() / 1000);
  return signHs256(
    {
      iss: 'https://connect.nulls.gg',
      aud: config.auth.clientId,
      sub: uuidFrom(`mock:${profile.username}`),
      iat: now,
      exp: now + 3600,
      name: profile.name,
      preferred_username: profile.username,
      email: profile.email,
      is_beta: profile.is_beta,
    },
    config.session.secret,
  );
}

/* ------------------------------------------------------------------ *
 * Express glue
 * ------------------------------------------------------------------ */

export function attachUser(req, _res, next) {
  req.cookies = parseCookies(req.headers.cookie);
  req.user = getSession(req.cookies[config.session.cookie]);
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

/**
 * The live service gates script execution behind beta access and answers
 * callers without it with a 404 that looks exactly like a missing script.
 */
export function requireBeta(req, res, next) {
  if (!config.limits.betaRequired) return next();
  if (req.user?.is_beta) return next();
  return res.status(404).json({ error: 'Script not found' });
}
