import crypto from 'node:crypto';
import { Router } from 'express';
import config from '../config.js';
import db, { persist } from '../db.js';
import { createSession, destroySession, mockIdToken, sessionCookie, verifyIdToken } from '../auth.js';
import { nowMicro } from '../time.js';

const router = Router();

/** Upsert a user record from verified id_token claims. */
export function upsertUser(profile) {
  const existing = db.users.find((u) => u.user_id === profile.user_id);
  if (existing) {
    existing.name = profile.name;
    existing.username = profile.username;
    if (profile.email !== undefined) existing.email = profile.email;
    if (profile.avatar_url !== undefined) existing.avatar_url = profile.avatar_url;
    if (profile.is_beta !== undefined) existing.is_beta = profile.is_beta;
    persist();
    return existing;
  }
  const user = {
    user_id: profile.user_id,
    name: profile.name,
    username: profile.username,
    email: profile.email ?? null,
    avatar_url: profile.avatar_url ?? null,
    is_beta: Boolean(profile.is_beta),
    created_at: nowMicro(),
  };
  db.users.push(user);
  persist();
  return user;
}

/* ------------------------------------------------------------------ *
 * Session establishment
 *
 * The id_token arrives in the URL fragment, which browsers never send to
 * the server — so the SPA posts it here.
 * ------------------------------------------------------------------ */

router.post('/api/auth/session', async (req, res) => {
  const idToken = req.body?.id_token;
  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'Missing id_token' });
  }
  try {
    const profile = await verifyIdToken(idToken);
    const user = upsertUser(profile);
    const token = createSession(user.user_id);
    res.setHeader('set-cookie', sessionCookie(token));
    return res.json({
      user_id: user.user_id,
      name: user.name,
      username: user.username,
      avatar_url: user.avatar_url ?? null,
      is_beta: Boolean(user.is_beta),
    });
  } catch (err) {
    console.error('[auth] id_token rejected:', err.message);
    return res.status(401).json({ error: 'Invalid id_token' });
  }
});

router.post('/logout', (req, res) => {
  destroySession(req.cookies[config.session.cookie]);
  res.setHeader('set-cookie', sessionCookie('', { maxAge: 0 }));
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Built-in development identity provider (AUTH_MODE=mock)
 *
 * Stands in for connect.nulls.gg: same OIDC implicit shape, HS256 id_token
 * delivered in the fragment. Set AUTH_MODE=connect plus CONNECT_CLIENT_ID to
 * talk to the genuine provider instead.
 * ------------------------------------------------------------------ */

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

router.get('/dev/connect/authorize', (req, res) => {
  if (config.auth.mode !== 'mock') return res.status(404).end();
  const q = new URLSearchParams(req.query);
  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Null's Connect</title>
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
  .tag{display:inline-block;padding:2px 8px;border-radius:999px;background:#123028;color:#7ee0c8;font-size:11px;margin-left:8px}
</style></head><body>
<form class="card" method="post" action="/dev/connect/authorize">
  <h1>Development sign-in</h1>
  <p>Local stand-in for Null's Connect, used when no OAuth client is configured.</p>
  <input type="hidden" name="redirect_uri" value="${escapeHtml(q.get('redirect_uri') || '')}">
  <button type="submit" name="account" value="beta">Beta Tester<span class="tag">beta access</span>
    <small>Can publish scripts and start friendly battles</small></button>
  <button type="submit" name="account" value="guest">Guest Player
    <small>Can browse and save, but not launch battles</small></button>
</form></body></html>`);
});

router.post('/dev/connect/authorize', (req, res) => {
  if (config.auth.mode !== 'mock') return res.status(404).end();
  const account = req.body?.account === 'guest' ? 'guest' : 'beta';
  const redirectUri = String(req.body?.redirect_uri || '/connect');
  if (!redirectUri.startsWith('/')) return res.status(400).json({ error: 'invalid redirect_uri' });

  // Implicit flow: the credential travels in the fragment.
  const idToken = mockIdToken(account);
  res.redirect(`${redirectUri}#id_token=${encodeURIComponent(idToken)}`);
});

export default router;
