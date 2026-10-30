import crypto from 'node:crypto';
import { Router } from 'express';
import config from '../config.js';
import db, { persist } from '../db.js';
import { authorizeUrl, createSession, destroySession, exchangeCode, sessionCookie } from '../auth.js';
import { nowMicro } from '../time.js';

const router = Router();

/** Short-lived CSRF state for the OAuth round trip. */
const pendingStates = new Map();

function safeReturnTo(value) {
  const target = String(value || '/');
  // Only allow same-origin relative paths — never an absolute URL.
  if (!target.startsWith('/') || target.startsWith('//')) return '/';
  return target;
}

/** Upsert a user record from an OAuth profile. */
export function upsertUser(profile) {
  const existing = db.users.find((u) => u.user_id === profile.user_id);
  if (existing) {
    existing.name = profile.name;
    existing.username = profile.username;
    if (profile.avatar_url !== undefined) existing.avatar_url = profile.avatar_url;
    if (profile.is_beta !== undefined) existing.is_beta = profile.is_beta;
    persist();
    return existing;
  }
  const user = {
    user_id: profile.user_id,
    name: profile.name,
    username: profile.username,
    avatar_url: profile.avatar_url ?? null,
    is_beta: Boolean(profile.is_beta),
    created_at: nowMicro(),
  };
  db.users.push(user);
  persist();
  return user;
}

/* ------------------------------------------------------------------ *
 * Relying-party endpoints (served by this app)
 * ------------------------------------------------------------------ */

/** GET /connect?return_to=/ — entry point linked from the landing page. */
router.get('/connect', (req, res) => {
  const state = crypto.randomBytes(16).toString('base64url');
  pendingStates.set(state, {
    return_to: safeReturnTo(req.query.return_to),
    expires_at: Date.now() + 10 * 60 * 1000,
  });
  for (const [key, value] of pendingStates) {
    if (value.expires_at < Date.now()) pendingStates.delete(key);
  }
  res.redirect(authorizeUrl(req, state));
});

/** GET /connect/callback?code=…&state=… */
router.get('/connect/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const pending = state ? pendingStates.get(String(state)) : null;

  if (error) {
    return res.status(400).json({ error: `provider_error: ${error}` });
  }
  if (!pending) {
    return res.status(400).json({ error: 'Invalid or expired OAuth state' });
  }
  pendingStates.delete(String(state));

  if (!code) return res.status(400).json({ error: 'Missing authorization code' });

  try {
    const profile = await exchangeCode(req, String(code));
    const user = upsertUser(profile);
    const token = createSession(user.user_id);
    res.setHeader('set-cookie', sessionCookie(token));
    return res.redirect(pending.return_to);
  } catch (err) {
    console.error('[oauth] exchange failed:', err.message);
    return res.status(502).json({ error: 'Failed to complete sign-in' });
  }
});

/** POST /logout */
router.post('/logout', (req, res) => {
  destroySession(req.cookies[config.session.cookie]);
  res.setHeader('set-cookie', sessionCookie('', { maxAge: 0 }));
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Built-in development identity provider (AUTH_MODE=mock)
 *
 * Implements just enough of the OAuth 2.0 authorization-code flow for the
 * login round trip to work locally. Swap in real Null's Connect credentials
 * and set AUTH_MODE=connect to talk to the genuine provider instead.
 * ------------------------------------------------------------------ */

const devCodes = new Map();

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

router.get('/dev/connect/authorize', (req, res) => {
  if (config.auth.mode !== 'mock') return res.status(404).end();
  const q = new URLSearchParams(req.query);
  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Sign in — dev provider</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d1017;color:#e8ecf4;
       font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  .card{width:min(420px,92vw);background:#151a24;border:1px solid #262d3d;border-radius:14px;padding:28px}
  h1{font-size:19px;margin:0 0 6px}
  p{margin:0 0 22px;color:#8e99ae;font-size:13.5px}
  button{width:100%;padding:12px 14px;margin-bottom:10px;border-radius:10px;
         background:#1c2331;color:#e8ecf4;font-size:14px;cursor:pointer;text-align:left;border:1px solid #2c3547}
  button:hover{background:#232c3d}
  small{display:block;color:#6c7789;margin-top:2px;font-size:12px}
  .tag{display:inline-block;padding:2px 8px;border-radius:999px;background:#233;color:#7ee0c8;font-size:11px;margin-left:8px}
</style></head><body>
<form class="card" method="post" action="/dev/connect/authorize">
  <h1>Development sign-in</h1>
  <p>This local provider stands in for Null's Connect when no OAuth credentials are configured.</p>
  <input type="hidden" name="state" value="${escapeHtml(q.get('state') || '')}">
  <input type="hidden" name="redirect_uri" value="${escapeHtml(q.get('redirect_uri') || '')}">
  <button type="submit" name="account" value="beta">Beta Tester<span class="tag">beta access</span>
    <small>Can publish scripts and start friendly battles</small></button>
  <button type="submit" name="account" value="guest">Guest Player
    <small>Can browse and save, but not launch battles</small></button>
</form></body></html>`);
});

router.post('/dev/connect/authorize', (req, res) => {
  if (config.auth.mode !== 'mock') return res.status(404).end();
  const body = req.body || {};
  const account = body.account === 'guest' ? 'guest' : 'beta';
  const code = `${account}-${crypto.randomBytes(16).toString('base64url')}`;
  devCodes.set(code, { account, expires_at: Date.now() + 5 * 60 * 1000 });
  const redirect = new URL(String(body.redirect_uri), 'http://internal');
  redirect.searchParams.set('code', code);
  redirect.searchParams.set('state', String(body.state || ''));
  res.redirect(redirect.pathname + redirect.search);
});

router.post('/dev/connect/token', (req, res) => {
  if (config.auth.mode !== 'mock') return res.status(404).end();
  const code = String(req.body?.code || '');
  const entry = devCodes.get(code);
  if (!entry || entry.expires_at < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  devCodes.delete(code);
  return res.json({
    // The account is encoded in the token so the mock userinfo endpoint can
    // resolve it without server-side state.
    access_token: `mock.${entry.account}.${crypto.randomBytes(24).toString('base64url')}`,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: config.auth.scope,
  });
});

router.get('/dev/connect/userinfo', (req, res) => {
  if (config.auth.mode !== 'mock') return res.status(404).end();
  const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [, encoded] = token.split('.');
  const account = encoded === 'guest' ? 'guest' : 'beta';
  return res.json({
    id: crypto.createHash('sha1').update(`mock:${account}`).digest('hex').slice(0, 32),
    name: account === 'guest' ? 'Guest Player' : 'Beta Tester',
    username: account === 'guest' ? 'guestplayer' : 'betatester',
    is_beta: account === 'beta',
  });
});

export default router;
