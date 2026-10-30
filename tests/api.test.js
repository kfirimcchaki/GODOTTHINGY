import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

// Isolate state before any module reads the config.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nt-scripting-test-'));
process.env.DATA_DIR = dataDir;
process.env.AUTH_MODE = 'mock';
process.env.PORT = '0';

const { createApp } = await import('../server/app.js');

let server;
let base;

/** Minimal cookie jar so we can walk the OAuth round trip. */
function jar() {
  const cookies = new Map();
  return {
    header() {
      return [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    absorb(response) {
      for (const raw of response.headers.getSetCookie?.() || []) {
        const [pair] = raw.split(';');
        const eq = pair.indexOf('=');
        cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
  };
}

async function req(url, { jar: j, method = 'GET', body, headers = {}, raw } = {}) {
  const response = await fetch(base + url, {
    method,
    redirect: 'manual',
    headers: {
      ...(j ? { cookie: j.header() } : {}),
      ...(body && !raw ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  if (j) j.absorb(response);
  return response;
}

const json = async (response) => (response.status === 204 ? null : response.json());

/** Walk /connect → dev provider → /connect/callback and return the cookie jar. */
async function signIn(account = 'beta') {
  const j = jar();
  const step1 = await req('/connect?return_to=/', { jar: j });
  assert.equal(step1.status, 302);

  const authorize = new URL(step1.headers.get('location'), base);
  const params = authorize.searchParams;

  const step2 = await req('/dev/connect/authorize', {
    jar: j,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    raw: true,
    body: new URLSearchParams({
      state: params.get('state'),
      redirect_uri: params.get('redirect_uri'),
      account,
    }).toString(),
  });
  assert.equal(step2.status, 302);

  const step3 = await req(step2.headers.get('location'), { jar: j });
  assert.equal(step3.status, 302, 'callback should redirect to return_to');
  return j;
}

const SEEDED_ID = '01a18307-1527-7454-9557-e96cac0d2448';
const SEEDED_AUTHOR = '4572854d-b1b1-406b-82e8-b483998ae0c6';

before(async () => {
  const app = createApp();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ */

test('GET /api/health reports ok', async () => {
  const response = await req('/api/health');
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime_seconds, 'number');
});

test('GET /api/meta exposes capabilities and counters', async () => {
  const body = await json(await req('/api/meta'));
  assert.equal(body.auth_mode, 'mock');
  assert.equal(body.login_path, '/connect');
  assert.equal(body.beta_required, true);
  assert.ok(body.stats.scripts >= 2);
  assert.ok(body.stats.releases >= 12);
});

test('GET /api/scripts/:id returns the exact live payload shape', async () => {
  const response = await req(`/api/scripts/${SEEDED_ID}`);
  assert.equal(response.status, 200);
  const body = await json(response);

  assert.deepEqual(Object.keys(body).sort(), [
    'author_name',
    'author_uuid',
    'created_at',
    'description',
    'is_favorite',
    'name',
    'published_at',
    'script_id',
    'updated_at',
    'user_map_id',
    'user_map_internal_id',
  ]);

  assert.equal(body.script_id, SEEDED_ID);
  assert.equal(body.name, 'Among Us MODDED');
  assert.equal(body.user_map_id, 'ef521933-9e64-4408-be9f-aa0888d8dbeb');
  assert.equal(body.user_map_internal_id, 'CRPJR2C0U:9YGC8UV9RCJ');
  assert.equal(body.created_at, '2026-10-28T15:00:41.895585Z');
  assert.equal(body.published_at, '2026-10-29T16:10:18.287084Z');
  assert.equal(body.author_uuid, SEEDED_AUTHOR);
  assert.equal(body.author_name, 'ReareKit');
  assert.equal(body.is_favorite, false);

  // Anonymous callers never see source.
  assert.equal(body.code, undefined);
});

test('timestamps keep microsecond precision', async () => {
  const body = await json(await req(`/api/scripts/${SEEDED_ID}`));
  assert.match(body.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
});

test('GET /api/scripts/:id/releases returns the seeded release history', async () => {
  const body = await json(await req(`/api/scripts/${SEEDED_ID}/releases`));
  assert.equal(body.releases.length, 11);
  assert.deepEqual(
    body.releases.map((r) => r.id),
    [15862, 15887, 15927, 15947, 15948, 15950, 15957, 16083, 16090, 16124, 16126],
  );
  assert.deepEqual(Object.keys(body.releases[0]).sort(), ['created_at', 'description', 'id']);
  assert.equal(body.releases[0].description, null);
  assert.equal(body.releases.at(-1).created_at, '2026-10-29T15:33:17.189466Z');
});

test('GET /api/users/:id returns exactly three public fields', async () => {
  const body = await json(await req(`/api/users/${SEEDED_AUTHOR}`));
  assert.deepEqual(body, { user_id: SEEDED_AUTHOR, name: 'ReareKit', username: 'rearekit' });
});

test('unknown script and malformed id both 404', async () => {
  const missing = await req('/api/scripts/01a00000-0000-7000-8000-000000000000');
  assert.equal(missing.status, 404);
  assert.deepEqual(await json(missing), { error: 'Script not found' });

  const malformed = await req('/api/scripts/not-a-uuid');
  assert.equal(malformed.status, 404);
  assert.deepEqual(await json(malformed), { error: 'Script not found' });
});

test('unknown /api route returns JSON, not the SPA shell', async () => {
  const response = await req('/api/nope');
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await json(response), { error: 'Not found' });
});

test('unmatched paths fall through to the SPA shell (as on the live site)', async () => {
  for (const url of ['/robots.txt', '/some/deep/route']) {
    const response = await req(url);
    assert.equal(response.status, 200, url);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const text = await response.text();
    assert.ok(text.includes('NT Scripting'));
  }
});

/* ------------------------------------------------------------------ */

test('GET /api/me is 401 without a session', async () => {
  const response = await req('/api/me');
  assert.equal(response.status, 401);
  assert.deepEqual(await json(response), { error: 'Unauthorized' });
});

test('OAuth round trip establishes a session', async () => {
  const j = await signIn('beta');
  const response = await req('/api/me', { jar: j });
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.equal(body.name, 'Beta Tester');
  assert.equal(body.username, 'betatester');
  assert.equal(body.is_beta, true);
});

test('POST /connect/callback rejects a forged state', async () => {
  const response = await req('/connect/callback?code=whatever&state=nope');
  assert.equal(response.status, 400);
  assert.match((await json(response)).error, /state/i);
});

/* ------------------------------------------------------------------ */

test('author can create, save, publish and read a script', async () => {
  const j = await signIn('beta');

  const created = await req('/api/scripts', { jar: j, method: 'POST', body: { name: 'Test Mode', code: 'function tick() end' } });
  assert.equal(created.status, 201);
  const script = await json(created);
  assert.match(script.script_id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(script.name, 'Test Mode');
  assert.equal(script.published_at, null);
  assert.equal(script.author_name, 'Beta Tester');

  // Saving the source cuts a release.
  const saved = await json(await req(`/api/scripts/${script.script_id}/code`, { jar: j, method: 'PUT', body: { code: 'function tick() log("hi") end' } }));
  assert.equal(saved.release.description, null);
  assert.match(saved.release.created_at, /\.\d{6}Z$/);

  const releaseList = await json(await req(`/api/scripts/${script.script_id}/releases`, { jar: j }));
  assert.ok(releaseList.releases.length >= 2, 'create + save should both produce releases');

  // A draft's releases stay hidden from anonymous callers.
  const anonymousReleases = await req(`/api/scripts/${script.script_id}/releases`);
  assert.equal(anonymousReleases.status, 404);

  // Release ids continue from the seeded counter.
  assert.ok(saved.release.id > 16126, `expected id > 16126, got ${saved.release.id}`);

  // Publishing binds a user map.
  const published = await json(await req(`/api/scripts/${script.script_id}/publish`, { jar: j, method: 'POST' }));
  assert.ok(published.published_at);
  assert.match(published.user_map_id, /^[0-9a-f-]{36}$/);
  assert.match(published.user_map_internal_id, /^[0-9A-Z]{9}:[0-9A-Z]{9}$/);

  // Owners see source on the detail route; strangers do not.
  const asOwner = await json(await req(`/api/scripts/${script.script_id}`, { jar: j }));
  assert.equal(typeof asOwner.code, 'string');
  assert.equal(asOwner.is_published, true);

  const asStranger = await json(await req(`/api/scripts/${script.script_id}`));
  assert.equal(asStranger.code, undefined);

  // Validation
  const badName = await req('/api/scripts', { jar: j, method: 'POST', body: { name: '   ' } });
  assert.equal(badName.status, 400);
  assert.deepEqual(await json(badName), { error: 'Name is required' });
});

test('raw .lua upload creates a script named after the file', async () => {
  const j = await signIn('beta');
  const response = await req('/api/scripts?filename=my_mode.lua', {
    jar: j,
    method: 'POST',
    raw: true,
    headers: { 'content-type': 'text/plain' },
    body: 'function tick() end',
  });
  assert.equal(response.status, 201);
  const body = await json(response);
  assert.equal(body.name, 'my_mode');
  assert.equal(body.code, 'function tick() end');
});

test('other users cannot modify or delete a script', async () => {
  const owner = await signIn('beta');
  const created = await json(await req('/api/scripts', { jar: owner, method: 'POST', body: { name: 'Owned' } }));

  const guest = await signIn('guest');
  const patch = await req(`/api/scripts/${created.script_id}`, { jar: guest, method: 'PATCH', body: { name: 'Hijacked' } });
  assert.equal(patch.status, 404);

  const del = await req(`/api/scripts/${created.script_id}`, { jar: guest, method: 'DELETE' });
  assert.equal(del.status, 404);

  const stillThere = await req(`/api/scripts/${created.script_id}`, { jar: owner });
  assert.equal(stillThere.status, 200);
});

/* ------------------------------------------------------------------ */

test('share is beta-gated and 404s for non-beta callers', async () => {
  const owner = await signIn('beta');
  const script = await json(await req('/api/scripts', { jar: owner, method: 'POST', body: { name: 'Share Me' } }));
  await req(`/api/scripts/${script.script_id}/publish`, { jar: owner, method: 'POST' });

  // A guest who owns nothing cannot share — and gets the same 404 the live
  // service returns, even though the script is published and readable.
  const guest = await signIn('guest');
  const denied = await req(`/api/scripts/${script.script_id}/share`, { jar: guest, method: 'POST' });
  assert.equal(denied.status, 404);
  assert.deepEqual(await json(denied), { error: 'Script not found' });

  // The published script is nonetheless publicly readable.
  const readable = await req(`/api/scripts/${script.script_id}`);
  assert.equal(readable.status, 200);
});

test('unpublished scripts 404 on share even for their beta owner', async () => {
  const owner = await signIn('beta');
  const script = await json(await req('/api/scripts', { jar: owner, method: 'POST', body: { name: 'Draft' } }));
  const response = await req(`/api/scripts/${script.script_id}/share`, { jar: owner, method: 'POST' });
  assert.equal(response.status, 404);
  assert.deepEqual(await json(response), { error: 'Script not found' });
});

test('a beta owner can create a launch link', async () => {
  const owner = await signIn('beta');
  const script = await json(await req('/api/scripts', { jar: owner, method: 'POST', body: { name: 'Launchable' } }));
  await req(`/api/scripts/${script.script_id}/publish`, { jar: owner, method: 'POST' });

  const response = await req(`/api/scripts/${script.script_id}/share`, { jar: owner, method: 'POST' });
  assert.equal(response.status, 201);
  const body = await json(response);
  assert.equal(body.script_id, script.script_id);
  assert.match(body.launch_url, /^nullsbrawl:\/\/scripting\/play\?token=/);
  assert.match(body.share_url, /\/s\/[\w-]+$/);

  // The share page resolves.
  const token = body.share_url.split('/s/')[1];
  const page = await req(`/s/${token}`);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('Launchable'));
});

/* ------------------------------------------------------------------ */

test('favorites round trip', async () => {
  const j = await signIn('beta');
  const star = await json(await req(`/api/scripts/${SEEDED_ID}/favorite`, { jar: j, method: 'POST' }));
  assert.deepEqual(star, { script_id: SEEDED_ID, is_favorite: true });

  const detail = await json(await req(`/api/scripts/${SEEDED_ID}`, { jar: j }));
  assert.equal(detail.is_favorite, true);

  const list = await json(await req('/api/favorites', { jar: j }));
  assert.equal(list.scripts.length, 1);

  const unstar = await json(await req(`/api/scripts/${SEEDED_ID}/favorite`, { jar: j, method: 'DELETE' }));
  assert.deepEqual(unstar, { script_id: SEEDED_ID, is_favorite: false });
});

test('listing, search and author filters work', async () => {
  const all = await json(await req('/api/scripts'));
  assert.ok(all.scripts.length >= 2);
  assert.deepEqual(Object.keys(all).sort(), ['limit', 'offset', 'scripts', 'total']);

  const searched = await json(await req('/api/scripts?query=among'));
  assert.ok(searched.scripts.some((s) => s.script_id === SEEDED_ID));

  const byAuthor = await json(await req(`/api/scripts?author=${SEEDED_AUTHOR}`));
  assert.ok(byAuthor.scripts.every((s) => s.author_uuid === SEEDED_AUTHOR));

  const authorPage = await json(await req(`/api/users/${SEEDED_AUTHOR}/scripts`));
  assert.equal(authorPage.user.username, 'rearekit');
  assert.ok(authorPage.scripts.length >= 1);
});

test('releases feed and single-release lookup', async () => {
  const feed = await json(await req('/api/releases'));
  assert.ok(feed.releases.length > 0);
  assert.ok(feed.releases.every((r) => r.script_name));

  const owner = await signIn('beta');
  const mine = await json(await req('/api/users/' + (await json(await req('/api/me', { jar: owner }))).user_id + '/scripts', { jar: owner }));
  const owned = mine.scripts[0];
  const releases = await json(await req(`/api/scripts/${owned.script_id}/releases`));
  const one = await req(`/api/scripts/${owned.script_id}/releases/${releases.releases[0].id}`, { jar: owner });
  assert.equal(one.status, 200);
  assert.equal(typeof (await json(one)).code, 'string');

  // Anonymous callers cannot read release source.
  const anonymous = await req(`/api/scripts/${owned.script_id}/releases/${releases.releases[0].id}`);
  assert.equal(anonymous.status, 401);
});

test('delete removes the script, its releases and its favorites', async () => {
  const owner = await signIn('beta');
  const script = await json(await req('/api/scripts', { jar: owner, method: 'POST', body: { name: 'Doomed' } }));
  await req(`/api/scripts/${script.script_id}/publish`, { jar: owner, method: 'POST' });
  await req(`/api/scripts/${script.script_id}/favorite`, { jar: owner, method: 'POST' });

  const del = await req(`/api/scripts/${script.script_id}`, { jar: owner, method: 'DELETE' });
  assert.equal(del.status, 204);

  const gone = await req(`/api/scripts/${script.script_id}`);
  assert.equal(gone.status, 404);

  // The releases sub-resource disappears with the script.
  const releases = await req(`/api/scripts/${script.script_id}/releases`);
  assert.equal(releases.status, 404);
  assert.deepEqual(await json(releases), { error: 'Script not found' });

  // And it drops out of the favorites list.
  const favorites = await json(await req('/api/favorites', { jar: owner }));
  assert.ok(!favorites.scripts.some((s) => s.script_id === script.script_id));
});

test('static assets are served', async () => {
  for (const url of ['/styles.css', '/app.js', '/favicon.svg', '/nulls-connect-32.png']) {
    const response = await req(url);
    assert.equal(response.status, 200, url);
  }
  const png = await req('/nulls-connect-32.png');
  const bytes = Buffer.from(await png.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test('malformed JSON is rejected cleanly', async () => {
  const j = await signIn('beta');
  const response = await req('/api/scripts', {
    jar: j,
    method: 'POST',
    raw: true,
    headers: { 'content-type': 'application/json' },
    body: '{"name": ',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await json(response), { error: 'Malformed JSON body' });
});
