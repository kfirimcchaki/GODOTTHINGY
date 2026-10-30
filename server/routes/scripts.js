import { Router } from 'express';
import config from '../config.js';
import db, { persist, save } from '../db.js';
import { UUID_RE, internalMapId, shareToken, uuidv7 } from '../ids.js';
import { requireBeta, requireUser } from '../auth.js';
import { nowMicro } from '../time.js';

const router = Router();

const MAX_NAME = 128;
const MAX_DESCRIPTION = 2048;

/* ------------------------------------------------------------------ *
 * Serialisation — must match the live payloads exactly.
 * ------------------------------------------------------------------ */

export function serialiseScript(script, viewer) {
  const favorite = Boolean(
    viewer && db.favorites.some((f) => f.user_id === viewer.user_id && f.script_id === script.script_id),
  );
  return {
    script_id: script.script_id,
    name: script.name,
    description: script.description ?? null,
    user_map_id: script.user_map_id ?? null,
    user_map_internal_id: script.user_map_internal_id ?? null,
    created_at: script.created_at,
    updated_at: script.updated_at,
    published_at: script.published_at ?? null,
    author_uuid: script.author_uuid,
    author_name: script.author_name,
    is_favorite: favorite,
  };
}

function serialiseRelease(release) {
  return { id: release.id, description: release.description ?? null, created_at: release.created_at };
}

export function findScript(scriptId) {
  return db.scripts.find((s) => s.script_id === scriptId) || null;
}

function isOwner(script, user) {
  return Boolean(user && script.author_uuid === user.user_id);
}

/**
 * A script is readable by anyone once published. Unpublished drafts are only
 * visible to their author — everyone else gets the same 404 the live service
 * returns for an unknown id, so the two cases are indistinguishable.
 */
function readable(script, user) {
  return script && (script.published_at !== null || isOwner(script, user));
}

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

/* ------------------------------------------------------------------ *
 * Collection
 * ------------------------------------------------------------------ */

router.get('/', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const query = String(req.query.query || req.query.q || '').trim().toLowerCase();
  const author = req.query.author ? String(req.query.author) : null;
  const sort = String(req.query.sort || 'updated');

  let items = db.scripts.filter((s) => s.published_at !== null || (req.user && s.author_uuid === req.user.user_id));

  if (author) items = items.filter((s) => s.author_uuid === author || s.author_name.toLowerCase() === author.toLowerCase());
  if (query) {
    items = items.filter(
      (s) => s.name.toLowerCase().includes(query) || (s.description || '').toLowerCase().includes(query),
    );
  }
  if (req.query.favorites && req.user) {
    const mine = new Set(db.favorites.filter((f) => f.user_id === req.user.user_id).map((f) => f.script_id));
    items = items.filter((s) => mine.has(s.script_id));
  }

  const key = sort === 'created' ? 'created_at' : sort === 'name' ? 'name' : 'updated_at';
  items = [...items].sort((a, b) => {
    const cmp = sort === 'name' ? a.name.localeCompare(b.name) : Date.parse(b[key]) - Date.parse(a[key]);
    return cmp;
  });

  const total = items.length;
  const page = items.slice(offset, offset + limit);
  res.json({
    scripts: page.map((s) => serialiseScript(s, req.user)),
    total,
    limit,
    offset,
  });
});

/** Create a script — either a JSON body or a raw .lua upload. */
router.post('/', requireUser, (req, res) => {
  const isRaw = !req.is('application/json');
  let name;
  let description = null;
  let code = '';

  if (isRaw) {
    code = typeof req.body === 'string' ? req.body : '';
    const filename = String(req.query.filename || 'script.lua');
    name = String(req.query.name || filename.replace(/\.lu?a?$/i, '')).slice(0, MAX_NAME) || 'Untitled';
  } else {
    const body = req.body || {};
    name = typeof body.name === 'string' ? body.name.trim() : '';
    description = body.description == null ? null : String(body.description).slice(0, MAX_DESCRIPTION);
    code = body.code == null ? '' : String(body.code);
  }

  if (!name) return badRequest(res, 'Name is required');
  if (name.length > MAX_NAME) return badRequest(res, `Name must be at most ${MAX_NAME} characters`);
  if (Buffer.byteLength(code, 'utf8') > config.limits.maxCodeBytes) {
    return badRequest(res, 'Script is too large');
  }

  const now = nowMicro();
  const script = {
    script_id: uuidv7(),
    name,
    description,
    code,
    user_map_id: null,
    user_map_internal_id: null,
    created_at: now,
    updated_at: now,
    published_at: null,
    author_uuid: req.user.user_id,
    author_name: req.user.name,
  };
  db.scripts.push(script);

  db.releases.push({
    id: db.nextReleaseId(),
    script_id: script.script_id,
    description: null,
    code,
    created_at: now,
  });

  save();
  res.status(201).json({ ...serialiseScript(script, req.user), code });
});

/* ------------------------------------------------------------------ *
 * Single script
 * ------------------------------------------------------------------ */

router.get('/:scriptId', (req, res) => {
  if (!UUID_RE.test(req.params.scriptId)) {
    return res.status(404).json({ error: 'Script not found' });
  }
  const script = findScript(req.params.scriptId);
  if (!readable(script, req.user)) return res.status(404).json({ error: 'Script not found' });

  const payload = serialiseScript(script, req.user);
  // Authors (and only authors) also see the current source and draft state.
  if (isOwner(script, req.user)) {
    payload.code = script.code;
    payload.is_published = script.published_at !== null;
  }
  return res.json(payload);
});

router.patch('/:scriptId', requireUser, (req, res) => {
  const script = findScript(req.params.scriptId);
  if (!script || !isOwner(script, req.user)) return res.status(404).json({ error: 'Script not found' });

  const body = req.body || {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return badRequest(res, 'Name is required');
    if (name.length > MAX_NAME) return badRequest(res, `Name must be at most ${MAX_NAME} characters`);
    script.name = name;
  }
  if (body.description !== undefined) {
    script.description = body.description == null ? null : String(body.description).slice(0, MAX_DESCRIPTION);
  }
  script.updated_at = nowMicro();
  save();
  return res.json(serialiseScript(script, req.user));
});

router.delete('/:scriptId', requireUser, (req, res) => {
  const index = db.scripts.findIndex((s) => s.script_id === req.params.scriptId);
  if (index < 0 || db.scripts[index].author_uuid !== req.user.user_id) {
    return res.status(404).json({ error: 'Script not found' });
  }
  const [removed] = db.scripts.splice(index, 1);
  for (let i = db.releases.length - 1; i >= 0; i -= 1) {
    if (db.releases[i].script_id === removed.script_id) db.releases.splice(i, 1);
  }
  for (let i = db.favorites.length - 1; i >= 0; i -= 1) {
    if (db.favorites[i].script_id === removed.script_id) db.favorites.splice(i, 1);
  }
  save();
  return res.status(204).end();
});

/* ------------------------------------------------------------------ *
 * Code — saving a script cuts a new release, as on the live service.
 * ------------------------------------------------------------------ */

router.put('/:scriptId/code', requireUser, (req, res) => {
  const script = findScript(req.params.scriptId);
  if (!script || !isOwner(script, req.user)) return res.status(404).json({ error: 'Script not found' });

  const body = req.body || {};
  const code = typeof body.code === 'string' ? body.code : '';
  if (Buffer.byteLength(code, 'utf8') > config.limits.maxCodeBytes) {
    return badRequest(res, 'Script is too large');
  }

  const now = nowMicro();
  script.code = code;
  script.updated_at = now;
  if (body.description !== undefined) {
    script.description = body.description == null ? null : String(body.description).slice(0, MAX_DESCRIPTION);
  }

  const release = {
    id: db.nextReleaseId(),
    script_id: script.script_id,
    description: body.release_description ?? null,
    code,
    created_at: now,
  };
  db.releases.push(release);
  save();

  return res.status(200).json({ ...serialiseScript(script, req.user), release: serialiseRelease(release) });
});

router.get('/:scriptId/code', requireUser, (req, res) => {
  const script = findScript(req.params.scriptId);
  if (!script || !isOwner(script, req.user)) return res.status(404).json({ error: 'Script not found' });
  return res.json({ script_id: script.script_id, code: script.code, updated_at: script.updated_at });
});

/* ------------------------------------------------------------------ *
 * Publishing
 * ------------------------------------------------------------------ */

router.post('/:scriptId/publish', requireUser, (req, res) => {
  const script = findScript(req.params.scriptId);
  if (!script || !isOwner(script, req.user)) return res.status(404).json({ error: 'Script not found' });

  script.published_at = script.published_at || nowMicro();
  script.updated_at = nowMicro();
  // Publishing binds the script to a user map, mirroring the live payload.
  if (!script.user_map_id) {
    script.user_map_id = uuidv7();
    script.user_map_internal_id = internalMapId();
  }
  save();
  return res.json(serialiseScript(script, req.user));
});

router.post('/:scriptId/unpublish', requireUser, (req, res) => {
  const script = findScript(req.params.scriptId);
  if (!script || !isOwner(script, req.user)) return res.status(404).json({ error: 'Script not found' });
  script.published_at = null;
  script.updated_at = nowMicro();
  save();
  return res.json(serialiseScript(script, req.user));
});

/* ------------------------------------------------------------------ *
 * Share — "Start friendly battle"
 *
 * Beta-gated: callers without beta access get 404 {"error":"Script not found"}
 * even for a published script they can otherwise read. This reproduces the
 * behaviour reported against the live service.
 * ------------------------------------------------------------------ */

router.post('/:scriptId/share', requireUser, requireBeta, (req, res) => {
  const script = findScript(req.params.scriptId);
  if (!script || script.published_at === null) return res.status(404).json({ error: 'Script not found' });

  const releases = db.releases.filter((r) => r.script_id === script.script_id);
  const release = releases.at(-1);
  const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
  const token = shareToken();

  db.shareLinks.push({
    token,
    script_id: script.script_id,
    release_id: release ? release.id : null,
    created_by: req.user.user_id,
    created_at: nowMicro(),
  });
  persist();

  return res.status(201).json({
    share_url: `${base}/s/${token}`,
    launch_url: `nullsbrawl://scripting/play?token=${token}`,
    script_id: script.script_id,
    release_id: release ? release.id : null,
    expires_at: null,
  });
});

router.get('/:scriptId/share', requireUser, (req, res) => {
  const script = findScript(req.params.scriptId);
  if (!script) return res.status(404).json({ error: 'Script not found' });
  const links = db.shareLinks
    .filter((l) => l.script_id === script.script_id)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 20);
  const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
  return res.json({
    links: links.map((l) => ({
      share_url: `${base}/s/${l.token}`,
      launch_url: `nullsbrawl://scripting/play?token=${l.token}`,
      release_id: l.release_id,
      created_at: l.created_at,
    })),
  });
});

/* ------------------------------------------------------------------ *
 * Releases
 * ------------------------------------------------------------------ */

router.get('/:scriptId/releases', (req, res) => {
  if (!UUID_RE.test(req.params.scriptId)) return res.status(404).json({ error: 'Script not found' });
  const script = findScript(req.params.scriptId);
  if (!readable(script, req.user)) return res.status(404).json({ error: 'Script not found' });

  const releases = db.releases
    .filter((r) => r.script_id === script.script_id)
    .sort((a, b) => a.id - b.id);
  return res.json({ releases: releases.map(serialiseRelease) });
});

router.get('/:scriptId/releases/:releaseId', requireUser, (req, res) => {
  const script = findScript(req.params.scriptId);
  if (!script || !isOwner(script, req.user)) return res.status(404).json({ error: 'Script not found' });

  const release = db.releases.find(
    (r) => r.script_id === script.script_id && String(r.id) === String(req.params.releaseId),
  );
  if (!release) return res.status(404).json({ error: 'Release not found' });
  return res.json({ ...serialiseRelease(release), code: release.code });
});

/* ------------------------------------------------------------------ *
 * Favorites
 * ------------------------------------------------------------------ */

router.post('/:scriptId/favorite', requireUser, (req, res) => {
  const script = findScript(req.params.scriptId);
  if (!readable(script, req.user)) return res.status(404).json({ error: 'Script not found' });

  const exists = db.favorites.some((f) => f.user_id === req.user.user_id && f.script_id === script.script_id);
  if (!exists) {
    db.favorites.push({ user_id: req.user.user_id, script_id: script.script_id, created_at: nowMicro() });
    persist();
  }
  return res.json({ script_id: script.script_id, is_favorite: true });
});

router.delete('/:scriptId/favorite', requireUser, (req, res) => {
  const index = db.favorites.findIndex((f) => f.user_id === req.user.user_id && f.script_id === req.params.scriptId);
  if (index >= 0) {
    db.favorites.splice(index, 1);
    persist();
  }
  return res.json({ script_id: req.params.scriptId, is_favorite: false });
});

export default router;
