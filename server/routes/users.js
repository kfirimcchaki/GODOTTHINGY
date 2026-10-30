import { Router } from 'express';
import db from '../db.js';
import { UUID_RE } from '../ids.js';
import { requireUser } from '../auth.js';
import { serialiseScript } from './scripts.js';

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

/** GET /api/users/:userId/scripts — everything this author has published. */
router.get('/:userId/scripts', (req, res) => {
  const user = db.users.find((u) => u.user_id === req.params.userId || u.username === req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const viewer = req.user && req.user.user_id === user.user_id ? req.user : null;
  const scripts = db.scripts
    .filter((s) => s.author_uuid === user.user_id && (s.published_at !== null || viewer))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));

  return res.json({ user: serialiseUser(user), scripts: scripts.map((s) => serialiseScript(s, req.user)) });
});

export default router;
