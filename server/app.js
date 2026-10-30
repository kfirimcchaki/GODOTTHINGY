import path from 'node:path';
import express from 'express';
import config from './config.js';
import db from './db.js';
import { attachUser } from './auth.js';
import { ensureSeeded } from '../scripts/seed.js';
import metaRoutes from './routes/meta.js';
import scriptRoutes from './routes/scripts.js';
import userRoutes from './routes/users.js';
import oauthRoutes from './routes/oauth.js';

export function createApp() {
  ensureSeeded();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));
  // Raw bodies let clients PUT/POST a .lua file straight through.
  app.use(express.text({ limit: '2mb', type: ['text/*', 'application/octet-stream', 'application/x-lua'] }));

  app.use((_req, res, next) => {
    res.setHeader('x-content-type-options', 'nosniff');
    next();
  });

  app.use(attachUser);

  /* ---- API ---- */
  app.use('/api', metaRoutes);
  app.use('/api/scripts', scriptRoutes);
  app.use('/api/users', userRoutes);

  /* ---- Auth (RP + bundled dev provider) ---- */
  app.use(oauthRoutes);

  /* ---- Share links ---- */
  app.get('/s/:token', (req, res) => {
    const link = db.shareLinks.find((l) => l.token === req.params.token);
    if (!link) return res.status(404).type('html').send(notFoundPage('Share link not found'));
    const script = db.scripts.find((s) => s.script_id === link.script_id);
    const launch = `nullsbrawl://scripting/play?token=${link.token}`;
    return res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(script?.name || 'Script')} — launch</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/styles.css"></head>
<body class="centered"><main class="card">
  <h1>${escapeHtml(script?.name || 'Script')}</h1>
  <p class="muted">Open this link in Null's Brawl to start a friendly battle running this script.</p>
  <p><a class="btn primary" href="${launch}">Start friendly battle</a></p>
  <p class="muted small">Release #${link.release_id ?? '—'}</p>
</main></body></html>`);
  });

  /* ---- Static frontend ---- */
  app.use(express.static(config.publicDir, { extensions: ['html'] }));

  /* ---- Unknown API routes: JSON, not the SPA shell ---- */
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  /* ---- SPA fallback (mirrors the live site, which serves its shell for
          every unmatched path — including /robots.txt) ---- */
  app.get('*', (req, res) => {
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });

  /* ---- Errors ---- */
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return _next(err);
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
    console.error('[error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function notFoundPage(title) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="/styles.css"></head>
<body class="centered"><main class="card"><h1>${title}</h1>
<p><a class="btn" href="/">Go to homepage</a></p></main></body></html>`;
}

export default createApp;
