import { Router } from 'express';
import config from '../config.js';
import db from '../db.js';
import { requireUser } from '../auth.js';
import { serialiseScript } from './scripts.js';

const router = Router();

/** GET /api/health */
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: config.siteName,
    time: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
  });
});

/** GET /api/me — the signed-in account, plus its beta entitlement. */
router.get('/me', requireUser, (req, res) => {
  res.json({
    user_id: req.user.user_id,
    name: req.user.name,
    username: req.user.username,
    avatar_url: req.user.avatar_url ?? null,
    is_beta: Boolean(req.user.is_beta),
  });
});

/** GET /api/favorites */
router.get('/favorites', requireUser, (req, res) => {
  const ids = new Set(db.favorites.filter((f) => f.user_id === req.user.user_id).map((f) => f.script_id));
  const scripts = db.scripts.filter((s) => ids.has(s.script_id));
  res.json({ scripts: scripts.map((s) => serialiseScript(s, req.user)) });
});

/** GET /api/releases — the global release feed. */
router.get('/releases', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const published = new Set(db.scripts.filter((s) => s.published_at !== null).map((s) => s.script_id));
  const releases = db.releases
    .filter((r) => published.has(r.script_id))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, limit)
    .map((r) => {
      const script = db.scripts.find((s) => s.script_id === r.script_id);
      return {
        id: r.id,
        description: r.description ?? null,
        created_at: r.created_at,
        script_id: r.script_id,
        script_name: script ? script.name : null,
        author_name: script ? script.author_name : null,
      };
    });
  res.json({ releases });
});

/** GET /api/meta — capabilities the frontend renders from. */
router.get('/meta', (req, res) => {
  res.json({
    site_name: config.siteName,
    auth_mode: config.auth.mode,
    login_path: '/connect',
    beta_required: config.limits.betaRequired,
    max_code_bytes: config.limits.maxCodeBytes,
    max_events_per_second: config.limits.maxEventsPerSecond,
    oauth: {
      authorize_url: config.auth.mode === 'mock' ? '/dev/connect/authorize' : config.auth.authorizeUrl,
      client_id: config.auth.clientId,
      response_type: config.auth.responseType,
      scope: config.auth.scope,
      // The provider appends #sign_up; the mock provider does not.
      fragment: config.auth.mode === 'mock' ? '' : '#sign_up',
    },
    stats: {
      scripts: db.scripts.filter((s) => s.published_at !== null).length,
      releases: db.releases.length,
      authors: new Set(db.scripts.map((s) => s.author_uuid)).size,
    },
  });
});

export default router;
