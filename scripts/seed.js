/**
 * Seeds the store with the catalogue captured from the live service, so a
 * fresh checkout answers the same requests with the same payloads.
 *
 * The metadata lives in ./seed-data.js and was read off the public endpoints
 * of scripting.nulls.gg on 2026-10-30. Two release lists were captured in
 * full and are stored verbatim; the rest are synthesised (see below).
 */
import db, { save } from '../server/db.js';
import { SCRIPTS, USERS, RELEASE_ID_ANCHORS } from './seed-data.js';

/* ------------------------------------------------------------------ *
 * Release ids
 *
 * The live counter is a single globally increasing integer: a script created
 * in September starts at 1860 while one created in late October starts at
 * 15862. Only two release lists were captured, so the rest are interpolated
 * between the known (timestamp -> id) anchors, which keeps the counter
 * monotonic in time.
 * ------------------------------------------------------------------ */

/**
 * Every captured (timestamp -> id) pair, plus the coarse anchors, forms the
 * interpolation curve. Including the real release ids is what keeps
 * synthesised ids from overshooting them: the counter jumps 2125 -> 5516
 * across a quiet fortnight, which a straight line gets wrong.
 */
function buildAnchors(scripts) {
  const pairs = RELEASE_ID_ANCHORS.map(([iso, id]) => [Date.parse(iso), id]);
  for (const script of scripts) {
    if (!script.releases) continue;
    for (const [id, iso] of script.releases) pairs.push([Date.parse(iso), id]);
  }
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Keep only the points that move the curve forward; a dip would break it.
  const out = [];
  for (const pair of pairs) {
    const last = out[out.length - 1];
    if (!last || pair[1] > last[1]) out.push(pair);
  }
  return out;
}

function releaseIdAt(iso, anchors) {
  const t = Date.parse(iso);
  const last = anchors[anchors.length - 1];
  if (t <= anchors[0][0]) return anchors[0][1];
  if (t >= last[0]) return last[1];

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [t0, id0] = anchors[i];
    const [t1, id1] = anchors[i + 1];
    if (t >= t0 && t <= t1) {
      const ratio = (t - t0) / (t1 - t0);
      return Math.floor(id0 + ratio * (id1 - id0));
    }
  }
  return last[1];
}

/* ------------------------------------------------------------------ *
 * Source code
 *
 * Only the owner can read code, and none of it is public, so seeded scripts
 * get a plausible stub derived from their own name and description.
 * ------------------------------------------------------------------ */

function stubCode(script) {
  const header = (script.description ?? 'No description provided.')
    .split('\n')
    .map((line) => (line.length ? `-- ${line}` : '--'))
    .join('\n');

  return `-- ${script.name}
${header}

function tick()
    if server.isBattleEnded then return end
    if not server:isIntroFinished() then return end

    for i, character in server.objectManager:getCharacters() do
        -- ${script.name}: per-character behaviour goes here
    end
end
`;
}

/* ------------------------------------------------------------------ */

/**
 * Build the whole release timeline at once, in time order, so that ids come
 * out strictly increasing no matter how the scripts are created.
 *
 * Captured releases keep their real ids; synthesised ones are interpolated
 * from their timestamp and then clamped into the gap between the previous
 * assigned id and the next real one.
 */
function buildReleases(scripts) {
  const anchors = buildAnchors(scripts);
  const entries = [];
  for (const script of scripts) {
    if (script.releases) {
      for (const [id, createdAt] of script.releases) {
        entries.push({ script_id: script.script_id, created_at: createdAt, ts: Date.parse(createdAt), exact: id });
      }
      continue;
    }

    entries.push({
      script_id: script.script_id,
      created_at: script.created_at,
      ts: Date.parse(script.created_at),
      exact: null,
    });

    // A save landing more than an hour after creation counts as a release.
    const created = Date.parse(script.created_at);
    const updated = Date.parse(script.updated_at);
    if (updated - created > 60 * 60 * 1000) {
      entries.push({
        script_id: script.script_id,
        created_at: script.updated_at,
        ts: updated,
        exact: null,
      });
    }
  }

  entries.sort((a, b) => a.ts - b.ts || a.script_id.localeCompare(b.script_id));

  let previous = 0;
  return entries.map((entry, i) => {
    if (entry.exact !== null) {
      previous = Math.max(previous, entry.exact);
      return { id: entry.exact, script_id: entry.script_id, created_at: entry.created_at };
    }

    const low = previous + 1;
    let high = Infinity;
    for (let j = i + 1; j < entries.length; j += 1) {
      if (entries[j].exact !== null) {
        high = entries[j].exact - 1;
        break;
      }
    }

    const target = releaseIdAt(entry.created_at, anchors);
    const id = Math.min(Math.max(target, low), Math.max(low, high));
    previous = id;
    return { id, script_id: entry.script_id, created_at: entry.created_at };
  });
}

export function ensureSeeded() {
  if (db.isSeeded) return false;

  for (const user of USERS) {
    if (!db.users.some((u) => u.user_id === user.user_id)) {
      db.users.push({ ...user, avatar_url: null });
    }
  }

  const codeByScript = new Map();
  for (const script of SCRIPTS) {
    const { releases: _releases, ...record } = script;
    const code = stubCode(script);
    codeByScript.set(script.script_id, code);

    if (!db.scripts.some((s) => s.script_id === script.script_id)) {
      db.scripts.push({
        user_map_id: null,
        user_map_internal_id: null,
        ...record,
        code,
      });
    }
  }

  let highest = 0;
  for (const release of buildReleases(SCRIPTS)) {
    if (!db.releases.some((r) => r.id === release.id)) {
      db.releases.push({
        ...release,
        description: null,
        code: codeByScript.get(release.script_id) ?? '',
      });
    }
    highest = Math.max(highest, release.id);
  }

  db.setReleaseCounter(highest + 1);
  db.markSeeded();
  return true;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (invokedDirectly) {
  db.reset();
  ensureSeeded();
  save();
  console.log(
    `Seeded ${db.users.length} users, ${db.scripts.length} scripts, ${db.releases.length} releases.`,
  );
}
