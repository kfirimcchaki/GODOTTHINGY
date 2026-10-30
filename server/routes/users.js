import { Router } from 'express';
import db from '../db.js';
import { UUID_RE } from '../ids.js';
import { requireUser } from '../auth.js';
import { serialiseScriptListItem } from './scripts.js';

const router = Router();

function serialiseUser(user) {
  return { user_id: user.user_id, name: user.name, username: user.username };
}

/** GET /api/users/:userId — public, exactly three fields on the live service. */
router.get('/:userId', (req, res) => {
  if (!UUID_RE.test(req.params.userId)) return res.status(404).json({ error: 'User not found' });
  const user = db.users.find((u) => u.user_id === req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(serialiseUser(user));
});

/**
 * GET /api/users/:userId/scripts
 *
 * Public on the live service, and unpaginated: it returns the author and every
 * published script, oldest first. An author viewing their own profile also
 * sees their drafts.
 */
router.get('/:userId/scripts', (req, res) => {
  const id = req.params.userId;
  const user = db.users.find((u) => u.user_id === id || u.username.toLowerCase() === id.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });

  const isSelf = Boolean(req.user && req.user.user_id === user.user_id);
  const scripts = db.scripts
    .filter((s) => s.author_uuid === user.user_id && (s.published_at !== null || isSelf))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  return res.json({
    user: serialiseUser(user),
    scripts: scripts.map((s) => serialiseScriptListItem(s, req.user)),
  });
});

export default router;
