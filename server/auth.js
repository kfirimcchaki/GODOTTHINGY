import crypto from 'node:crypto';
import config from './config.js';
import db, { persist } from './db.js';
import { sessionToken } from './ids.js';

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
 * OAuth — "Null's Connect"
 *
 * In `mock` mode the whole provider is served locally under /dev/connect so
 * the login flow is end-to-end testable without third-party credentials.
 * ------------------------------------------------------------------ */

export function redirectUri(req) {
  if (config.auth.redirectUri) return config.auth.redirectUri;
  const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
  return `${base}/connect/callback`;
}

export function authorizeUrl(req, stateParam) {
  const params = new URLSearchParams({
    client_id: config.auth.clientId,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: config.auth.scope,
    state: stateParam,
  });
  if (config.auth.mode === 'mock') {
    return `/dev/connect/authorize?${params}`;
  }
  return `${config.auth.authorizeUrl}?${params}`;
}

/** Exchange an authorization code for a profile. Returns a user record. */
export async function exchangeCode(req, code) {
  if (config.auth.mode === 'mock') return mockProfile(code);

  const tokenResponse = await fetch(config.auth.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.auth.clientId,
      client_secret: config.auth.clientSecret,
      redirect_uri: redirectUri(req),
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`token exchange failed: HTTP ${tokenResponse.status}`);
  }
  const tokens = await tokenResponse.json();

  const userResponse = await fetch(config.auth.userinfoUrl, {
    headers: { authorization: `Bearer ${tokens.access_token}`, accept: 'application/json' },
  });
  if (!userResponse.ok) {
    throw new Error(`userinfo failed: HTTP ${userResponse.status}`);
  }
  const profile = await userResponse.json();
  return normaliseProfile(profile);
}

function normaliseProfile(profile) {
  const name = profile.name || profile.username || profile.login || 'Player';
  const username = (profile.username || profile.login || name).toString().toLowerCase().replace(/\s+/g, '');
  return {
    user_id: profile.id || profile.user_id || profile.uuid || uuidFrom(name),
    name: String(name),
    username,
    avatar_url: profile.avatar_url || profile.avatar || null,
    is_beta: Boolean(profile.is_beta ?? profile.beta ?? false),
  };
}

function uuidFrom(seed) {
  return crypto.createHash('sha1').update(seed).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5');
}

/* ------------------------------------------------------------------ *
 * Built-in development identity provider
 * ------------------------------------------------------------------ */

const MOCK_PROFILES = {
  beta: { name: 'Beta Tester', username: 'betatester', is_beta: true },
  guest: { name: 'Guest Player', username: 'guestplayer', is_beta: false },
};

export function mockProfile(code) {
  const key = code.startsWith('beta') ? 'beta' : code.startsWith('guest') ? 'guest' : 'beta';
  const profile = MOCK_PROFILES[key];
  return {
    user_id: uuidFrom(`mock:${profile.username}`),
    name: profile.name,
    username: profile.username,
    avatar_url: null,
    is_beta: profile.is_beta,
  };
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
