/* NT Scripting — single page app.
 *
 * A dependency-free client-side router plus a thin API client. Every screen
 * here is driven by the same JSON endpoints the live service exposes.
 */

const $view = document.getElementById('view');
const $nav = document.getElementById('nav');
const $session = document.getElementById('session');
const $stats = document.getElementById('footer-stats');
const $toasts = document.getElementById('toast-host');

let me = null;
let meta = { site_name: 'NT Scripting', auth_mode: 'mock', login_path: '/connect', beta_required: true };

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) && !options.raw
        ? { 'content-type': 'application/json' }
        : {}),
      ...(options.headers || {}),
    },
    body: options.raw ? options.body : options.body && !options.raw ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 204) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const err = new Error(data?.error || `Request failed (${response.status})`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

function toast(message, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  $toasts.append(el);
  setTimeout(() => el.remove(), 4200);
}

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function navigate(path, replace = false) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  render();
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-link]');
  if (!link) return;
  event.preventDefault();
  navigate(link.getAttribute('href'));
});
window.addEventListener('popstate', render);

/* ------------------------------------------------------------------ *
 * Chrome
 * ------------------------------------------------------------------ */

const NAV = [
  ['/', 'Home'],
  ['/browse', 'Browse'],
  ['/library', 'My scripts'],
  ['/favorites', 'Favorites'],
];

function renderChrome(pathname) {
  $nav.innerHTML = NAV.map(([href, label]) => {
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return `<a href="${href}" data-link class="${active ? 'active' : ''}">${label}</a>`;
  }).join('');

  if (me) {
    $session.innerHTML = `
      <span class="whoami">${esc(me.name)}${me.is_beta ? '<span class="beta">beta</span>' : ''}</span>
      <a class="btn small primary" href="/new" data-link>+ New</a>
      <button class="btn small" id="logout">Sign out</button>`;
    document.getElementById('logout').onclick = async () => {
      await api('/logout', { method: 'POST' });
      me = null;
      navigate('/');
    };
  } else {
    $session.innerHTML = `<a class="btn small primary" href="/connect?return_to=${encodeURIComponent(pathname)}">Sign in</a>`;
  }
}

/* ------------------------------------------------------------------ *
 * Screens
 * ------------------------------------------------------------------ */

function screenHome() {
  const s = meta.stats || {};
  return `
  <section class="hero">
    <h1>Heeeey, scripting is here!</h1>
    <p>Write Lua scripts that hook straight into the battle simulation, publish them, and start a friendly battle running your own game mode.</p>
    <div class="actions" style="justify-content:center">
      ${me
        ? `<a class="btn primary" href="/new" data-link>+ Create a script</a><a class="btn" href="/browse" data-link>Browse scripts</a>`
        : `<a class="btn primary" href="/connect?return_to=%2F"><img src="/nulls-connect-32.png" alt="" width="18" height="18"> Continue with Null's Connect</a>`}
    </div>
  </section>
  <div class="grid">
    <div class="card"><h3 style="margin-top:0">Tick-driven</h3><p class="muted small" style="margin:0">Every script exports a <code>tick()</code> function, called 20 times a second while the battle runs.</p></div>
    <div class="card"><h3 style="margin-top:0">Event hooks</h3><p class="muted small" style="margin:0">Subscribe to damage, skill and input events, then push custom UI back to the client.</p></div>
    <div class="card"><h3 style="margin-top:0">Sandboxed</h3><p class="muted small" style="margin:0">Each script runs isolated with a 15 ms per-call CPU budget and a 16 MiB memory cap.</p></div>
  </div>
  <h2>Recently updated</h2>
  <div id="home-feed"><div class="skeleton"></div></div>`;
}

async function hydrateHome() {
  try {
    const { scripts } = await api('/api/scripts?limit=6');
    const host = document.getElementById('home-feed');
    if (!host) return;
    host.outerHTML = scripts.length
      ? `<div class="grid">${scripts.map(cardHtml).join('')}</div>`
      : `<div class="empty">Nothing published yet.</div>`;
  } catch {
    /* non-fatal */
  }
}

function cardHtml(script) {
  return `
  <a class="script-card" href="/scripts/${esc(script.script_id)}" data-link>
    <h3>${esc(script.name)}</h3>
    <p class="desc">${esc(script.description || 'No description.')}</p>
    <div class="meta">
      <span>by ${esc(script.author_name)}</span><span>·</span>
      <span>updated ${fmtDate(script.updated_at)}</span>
      ${script.is_favorite ? '<span>·</span><span>★</span>' : ''}
    </div>
  </a>`;
}

function screenBrowse() {
  return `
  <div class="page-head"><div><h1>Browse</h1><p class="muted" style="margin:0">Published scripts from the community.</p></div></div>
  <div class="field"><input type="text" id="search" placeholder="Search by name or description…"></div>
  <div id="results"><div class="skeleton"></div></div>`;
}

async function hydrateBrowse() {
  const input = document.getElementById('search');
  const load = async () => {
    const q = encodeURIComponent(input.value.trim());
    try {
      const { scripts } = await api(`/api/scripts?limit=60${q ? `&query=${q}` : ''}`);
      document.getElementById('results').innerHTML = scripts.length
        ? `<div class="grid">${scripts.map(cardHtml).join('')}</div>`
        : `<div class="empty">No scripts match that search.</div>`;
    } catch (err) {
      document.getElementById('results').innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  };
  input.addEventListener('input', () => {
    clearTimeout(input._t);
    input._t = setTimeout(load, 220);
  });
  await load();
}

function screenLibrary() {
  if (!me) return signInPrompt('Sign in to see your own scripts.');
  return `
  <div class="page-head">
    <div><h1>My scripts</h1><p class="muted" style="margin:0">Drafts and published scripts you own.</p></div>
    <div class="actions">
      <label class="btn small" style="margin:0">Upload .lua<input type="file" id="upload" accept=".lua,.luau,.txt" hidden></label>
      <a class="btn small primary" href="/new" data-link>+ New script</a>
    </div>
  </div>
  <div id="results"><div class="skeleton"></div></div>`;
}

async function hydrateLibrary() {
  const fileInput = document.getElementById('upload');
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const created = await api(`/api/scripts?filename=${encodeURIComponent(file.name)}`, {
          method: 'POST',
          raw: true,
          headers: { 'content-type': 'text/plain' },
          body: await file.text(),
        });
        toast(`Uploaded “${created.name}”`);
        navigate(`/editor/${created.script_id}`);
      } catch (err) {
        toast(err.message, 'err');
      }
    });
  }
  try {
    const { scripts } = await api(`/api/users/${me.user_id}/scripts`);
    document.getElementById('results').innerHTML = scripts.length
      ? `<div class="grid">${scripts
          .map(
            (s) => `
        <div class="script-card">
          <h3><a href="/scripts/${esc(s.script_id)}" data-link>${esc(s.name)}</a></h3>
          <p class="desc">${esc(s.description || 'No description.')}</p>
          <div class="meta">
            <span class="badge ${s.published_at ? 'published' : 'draft'}">${s.published_at ? 'published' : 'draft'}</span>
            <span>updated ${fmtDate(s.updated_at)}</span>
          </div>
          <div class="actions">
            <a class="btn small" href="/editor/${esc(s.script_id)}" data-link>Edit</a>
            <button class="btn small danger" data-delete="${esc(s.script_id)}">Delete</button>
          </div>
        </div>`,
          )
          .join('')}</div>`
      : `<div class="empty">You have not created any scripts yet.</div>`;

    document.querySelectorAll('[data-delete]').forEach((button) => {
      button.onclick = async () => {
        if (!confirm('Delete this script and all of its releases?')) return;
        try {
          await api(`/api/scripts/${button.dataset.delete}`, { method: 'DELETE' });
          toast('Script deleted');
          render();
        } catch (err) {
          toast(err.message, 'err');
        }
      };
    });
  } catch (err) {
    document.getElementById('results').innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

async function screenFavorites() {
  if (!me) return signInPrompt('Sign in to see your favorites.');
  return `<div class="page-head"><div><h1>Favorites</h1></div></div><div id="results"><div class="skeleton"></div></div>`;
}

async function hydrateFavorites() {
  try {
    const { scripts } = await api('/api/favorites');
    document.getElementById('results').innerHTML = scripts.length
      ? `<div class="grid">${scripts.map(cardHtml).join('')}</div>`
      : `<div class="empty">No favorites yet. Star a script to keep it here.</div>`;
  } catch (err) {
    document.getElementById('results').innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

function signInPrompt(message) {
  return `<div class="notfound"><h1>Sign in required</h1>
    <p class="muted">${esc(message)}</p>
    <a class="btn primary" href="/connect?return_to=${encodeURIComponent(location.pathname)}">
      <img src="/nulls-connect-32.png" alt="" width="18" height="18"> Continue with Null's Connect</a></div>`;
}

async function screenScript(id) {
  let script;
  try {
    script = await api(`/api/scripts/${id}`);
  } catch (err) {
    return notFound(err.status === 404 ? 'Script not found' : err.message);
  }
  const { releases } = await api(`/api/scripts/${id}/releases`);
  const isOwner = me && me.user_id === script.author_uuid;

  return `
  <div class="page-head">
    <div>
      <h1>${esc(script.name)}</h1>
      <div class="actions">
        <span class="badge ${script.published_at ? 'published' : 'draft'}">${script.published_at ? 'published' : 'draft'}</span>
        <span class="muted small">by <a href="/users/${esc(script.author_uuid)}" data-link>${esc(script.author_name)}</a></span>
      </div>
    </div>
    <div class="actions">
      <button class="btn small" id="fav">${script.is_favorite ? '★ Unfavorite' : '☆ Favorite'}</button>
      ${isOwner ? `<a class="btn small" href="/editor/${esc(script.script_id)}" data-link>Edit</a>` : ''}
      <button class="btn primary" id="share">Start friendly battle</button>
    </div>
  </div>

  ${script.description ? `<p class="muted">${esc(script.description)}</p>` : ''}
  <div id="share-result"></div>

  <div class="card">
    <div class="meta small faint" style="display:grid;gap:6px">
      <div>Script ID <span class="mono">${esc(script.script_id)}</span></div>
      ${script.user_map_id ? `<div>User map <span class="mono">${esc(script.user_map_id)}</span> · <span class="mono">${esc(script.user_map_internal_id)}</span></div>` : ''}
      <div>Created ${fmtDate(script.created_at)} · Updated ${fmtDate(script.updated_at)}${script.published_at ? ` · Published ${fmtDate(script.published_at)}` : ''}</div>
    </div>
  </div>

  <h2>Releases</h2>
  ${releases.length
    ? `<ul class="releases">${releases
        .slice()
        .reverse()
        .map(
          (r) => `<li><span class="rid">#${r.id}</span>
                 <span class="muted small">${esc(r.description || 'No release notes')}</span>
                 <span class="rdate">${fmtDate(r.created_at)}</span></li>`,
        )
        .join('')}</ul>`
    : `<div class="empty">No releases yet.</div>`}

  ${script.code !== undefined
    ? `<h2>Source</h2><pre class="code-block">${esc(script.code)}</pre>`
    : ''}`;
}

async function hydrateScript(id) {
  const favButton = document.getElementById('fav');
  if (favButton) {
    favButton.onclick = async () => {
      if (!me) return navigate(`/connect?return_to=${encodeURIComponent(location.pathname)}`);
      const unstarring = favButton.textContent.includes('Unfavorite');
      try {
        await api(`/api/scripts/${id}/favorite`, { method: unstarring ? 'DELETE' : 'POST' });
        favButton.textContent = unstarring ? '☆ Favorite' : '★ Unfavorite';
      } catch (err) {
        toast(err.message, 'err');
      }
    };
  }

  const shareButton = document.getElementById('share');
  if (shareButton) {
    shareButton.onclick = async () => {
      if (!me) return navigate(`/connect?return_to=${encodeURIComponent(location.pathname)}`);
      const host = document.getElementById('share-result');
      shareButton.disabled = true;
      try {
        const result = await api(`/api/scripts/${id}/share`, { method: 'POST' });
        host.innerHTML = `<div class="notice">Launch link created.
          <div class="actions" style="margin-top:9px">
            <a class="btn small primary" href="${esc(result.launch_url)}">Open in Null's Brawl</a>
            <a class="btn small" href="${esc(result.share_url)}">Copyable page</a>
            <code class="mono">${esc(result.share_url)}</code>
          </div></div>`;
      } catch (err) {
        host.innerHTML = `<div class="error-box">${esc(err.message)}${
          err.status === 404 && meta.beta_required
            ? ' — starting a battle currently requires beta access on this deployment.'
            : ''
        }</div>`;
      } finally {
        shareButton.disabled = false;
      }
    };
  }
}

function screenNew() {
  if (!me) return signInPrompt('Sign in to create a script.');
  return `
  <div class="page-head"><div><h1>New script</h1></div></div>
  <div class="card">
    <div class="field"><label for="name">Name</label><input type="text" id="name" maxlength="128" placeholder="My game mode"></div>
    <div class="field"><label for="description">Description</label><input type="text" id="description" maxlength="2048" placeholder="What does this script do?"></div>
    <div class="actions"><button class="btn primary" id="create">Create</button>
      <a class="btn" href="/library" data-link>Cancel</a></div>
  </div>`;
}

async function hydrateNew() {
  document.getElementById('create').onclick = async () => {
    try {
      const created = await api('/api/scripts', {
        method: 'POST',
        body: {
          name: document.getElementById('name').value,
          description: document.getElementById('description').value || null,
          code: STARTER,
        },
      });
      toast('Script created');
      navigate(`/editor/${created.script_id}`);
    } catch (err) {
      toast(err.message, 'err');
    }
  };
}

const STARTER = `-- Every script must define a global tick() function.
-- It runs 20 times per second for the lifetime of the battle.

function tick()
    if server.isBattleEnded then
        return
    end
end
`;

async function screenEditor(id) {
  if (!me) return signInPrompt('Sign in to edit scripts.');
  let script;
  try {
    script = await api(`/api/scripts/${id}`);
  } catch (err) {
    return notFound(err.message);
  }
  if (script.code === undefined) {
    return `<div class="error-box">You can only edit scripts you own.</div>`;
  }
  return `
  <div class="page-head">
    <div><h1>${esc(script.name)}</h1>
      <div class="actions"><span class="badge ${script.published_at ? 'published' : 'draft'}" id="pub-badge">${script.published_at ? 'published' : 'draft'}</span>
      <a class="muted small" href="/scripts/${esc(script.script_id)}" data-link>View public page</a></div>
    </div>
    <div class="actions">
      <button class="btn" id="save">Save</button>
      <button class="btn primary" id="publish">${script.published_at ? 'Republish' : 'Publish'}</button>
    </div>
  </div>
  <div class="field"><label for="name">Name</label><input type="text" id="name" value="${esc(script.name)}" maxlength="128"></div>
  <div class="field"><label for="description">Description</label><input type="text" id="description" value="${esc(script.description || '')}" maxlength="2048"></div>
  <div class="field"><label for="code">script.lua</label><textarea class="code" id="code" spellcheck="false">${esc(script.code)}</textarea></div>
  <div class="actions small faint"><span id="status"></span></div>`;
}

async function hydrateEditor(id) {
  const status = document.getElementById('status');
  const code = document.getElementById('code');

  code.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const start = code.selectionStart;
    code.value = `${code.value.slice(0, start)}    ${code.value.slice(code.selectionEnd)}`;
    code.selectionStart = code.selectionEnd = start + 4;
  });

  document.getElementById('save').onclick = async () => {
    try {
      status.textContent = 'Saving…';
      await api(`/api/scripts/${id}`, {
        method: 'PATCH',
        body: {
          name: document.getElementById('name').value,
          description: document.getElementById('description').value || null,
        },
      });
      const result = await api(`/api/scripts/${id}/code`, {
        method: 'PUT',
        body: { code: code.value },
      });
      status.textContent = `Saved — release #${result.release.id} at ${fmtDate(result.release.created_at)}`;
      toast('Saved');
    } catch (err) {
      status.textContent = '';
      toast(err.message, 'err');
    }
  };

  document.getElementById('publish').onclick = async () => {
    try {
      await api(`/api/scripts/${id}/code`, { method: 'PUT', body: { code: code.value } });
      await api(`/api/scripts/${id}/publish`, { method: 'POST' });
      const badge = document.getElementById('pub-badge');
      badge.textContent = 'published';
      badge.className = 'badge published';
      toast('Published');
    } catch (err) {
      toast(err.message, 'err');
    }
  };
}

async function screenUser(userId) {
  let data;
  try {
    data = await api(`/api/users/${userId}/scripts`);
  } catch (err) {
    return notFound(err.message);
  }
  return `
  <div class="page-head"><div><h1>${esc(data.user.name)}</h1>
    <p class="muted mono" style="margin:0">@${esc(data.user.username)}</p></div></div>
  <h2>Scripts</h2>
  ${data.scripts.length ? `<div class="grid">${data.scripts.map(cardHtml).join('')}</div>` : `<div class="empty">No published scripts.</div>`}`;
}

function screenDocs() {
  return `
  <div class="page-head"><div><h1>HTTP API</h1>
  <p class="muted" style="margin:0;max-width:640px">Every endpoint this deployment serves. Public routes need no session; the rest require signing in.</p></div></div>
  <div class="card"><table class="api">
    <tr><th>Method</th><th>Path</th><th>Auth</th><th>Purpose</th></tr>
    ${ENDPOINTS.map(([m, p, a, d]) => `<tr><td><code>${m}</code></td><td><code>${esc(p)}</code></td><td>${a}</td><td class="muted">${d}</td></tr>`).join('')}
  </table></div>

  <h2>Example responses</h2>
  <div class="card"><p class="small muted" style="margin-top:0"><code>GET /api/scripts/:id</code></p>
  <pre class="code-block">${esc(JSON.stringify(EXAMPLE_SCRIPT, null, 2))}</pre></div>
  <div class="card"><p class="small muted" style="margin-top:0"><code>GET /api/scripts/:id/releases</code></p>
  <pre class="code-block">${esc(JSON.stringify(EXAMPLE_RELEASES, null, 2))}</pre></div>

  <h2>Lua scripting API</h2>
  <div class="card"><p class="muted" style="margin-top:0">Scripts are written in Lua (executed by Luau). Each one must define a global <code>tick()</code> function, and gets a <code>server</code> object as its entry point into the battle.</p>
  <p class="muted">Globals available to every script: <code>server</code>, <code>lookup</code>, <code>createObject</code>, <code>createCallback</code>, <code>log</code>, <code>event</code>, <code>json</code>.</p>
  <p class="muted" style="margin-bottom:0">The authoritative class-by-class reference is maintained upstream at
  <a href="https://github.com/nulls-mods-community/scripting-docs" rel="noopener">nulls-mods-community/scripting-docs</a>.</p></div>`;
}

const ENDPOINTS = [
  ['GET', '/api/health', 'no', 'Liveness probe'],
  ['GET', '/api/meta', 'no', 'Capabilities and counters'],
  ['GET', '/api/me', 'yes', 'The signed-in account'],
  ['GET', '/api/scripts', 'no', 'List published scripts (?query, ?author, ?limit, ?offset, ?sort)'],
  ['POST', '/api/scripts', 'yes', 'Create a script (JSON, or a raw .lua upload)'],
  ['GET', '/api/scripts/:id', 'no', 'Script metadata; owners also receive the source'],
  ['PATCH', '/api/scripts/:id', 'owner', 'Rename / re-describe'],
  ['DELETE', '/api/scripts/:id', 'owner', 'Delete the script and its releases'],
  ['PUT', '/api/scripts/:id/code', 'owner', 'Save source — cuts a new release'],
  ['GET', '/api/scripts/:id/code', 'owner', 'Read the current source'],
  ['POST', '/api/scripts/:id/publish', 'owner', 'Publish and bind a user map'],
  ['POST', '/api/scripts/:id/unpublish', 'owner', 'Withdraw from the public listing'],
  ['POST', '/api/scripts/:id/share', 'owner+beta', 'Create a friendly-battle launch link'],
  ['GET', '/api/scripts/:id/share', 'owner', 'List existing launch links'],
  ['GET', '/api/scripts/:id/releases', 'no', 'Release history'],
  ['GET', '/api/scripts/:id/releases/:rid', 'owner', 'One release with its source'],
  ['POST', '/api/scripts/:id/favorite', 'yes', 'Star a script'],
  ['DELETE', '/api/scripts/:id/favorite', 'yes', 'Unstar a script'],
  ['GET', '/api/users/:id', 'no', 'Public profile'],
  ['GET', '/api/users/:id/scripts', 'no', 'That author’s scripts'],
  ['GET', '/api/favorites', 'yes', 'Your starred scripts'],
  ['GET', '/api/releases', 'no', 'Global release feed'],
  ['GET', '/connect', 'no', 'Begin OAuth sign-in (?return_to)'],
  ['GET', '/connect/callback', 'no', 'OAuth redirect target'],
  ['POST', '/logout', 'yes', 'End the session'],
  ['GET', '/s/:token', 'no', 'Friendly-battle launch page'],
];

const EXAMPLE_SCRIPT = {
  script_id: '01a18307-1527-7454-9557-e96cac0d2448',
  name: 'Among Us MODDED',
  description: 'Among us v3.0.0, but with Sherrif, Jester, undertaker, medic, spy, …',
  user_map_id: 'ef521933-9e64-4408-be9f-aa0888d8dbeb',
  user_map_internal_id: 'CRPJR2C0U:9YGC8UV9RCJ',
  created_at: '2026-10-28T15:00:41.895585Z',
  updated_at: '2026-10-30T11:19:37.121507Z',
  published_at: '2026-10-29T16:10:18.287084Z',
  author_uuid: '4572854d-b1b1-406b-82e8-b483998ae0c6',
  author_name: 'ReareKit',
  is_favorite: false,
};

const EXAMPLE_RELEASES = {
  releases: [
    { id: 15862, description: null, created_at: '2026-10-28T15:00:41.895585Z' },
    { id: 15887, description: null, created_at: '2026-10-28T16:13:27.952037Z' },
  ],
};

function notFound(message = 'Page not found') {
  return `<div class="notfound"><h1>Page not found</h1>
    <p class="muted">${esc(message === 'Page not found' ? 'The page you are looking for does not exist or has been moved.' : message)}</p>
    <p class="code">404</p>
    <a class="btn" href="/" data-link>Go to homepage</a></div>`;
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

const ROUTES = [
  [/^\/$/, screenHome, hydrateHome],
  [/^\/browse$/, screenBrowse, hydrateBrowse],
  [/^\/library$/, screenLibrary, hydrateLibrary],
  [/^\/favorites$/, screenFavorites, hydrateFavorites],
  [/^\/new$/, screenNew, hydrateNew],
  [/^\/docs$/, screenDocs, null],
  [/^\/scripts\/([0-9a-f-]{36})$/i, screenScript, hydrateScript],
  [/^\/editor\/([0-9a-f-]{36})$/i, screenEditor, hydrateEditor],
  [/^\/users\/([0-9a-f-]{36})$/i, screenUser, null],
];

async function render() {
  const pathname = location.pathname;
  renderChrome(pathname);
  window.scrollTo(0, 0);

  for (const [pattern, screen, hydrate] of ROUTES) {
    const match = pathname.match(pattern);
    if (!match) continue;
    $view.innerHTML = '<div class="skeleton"></div>';
    const html = await screen(...match.slice(1));
    $view.innerHTML = html;
    if (hydrate) await hydrate(...match.slice(1));
    return;
  }
  $view.innerHTML = notFound();
}

async function boot() {
  try {
    meta = await api('/api/meta');
  } catch {
    /* keep defaults */
  }
  try {
    me = await api('/api/me');
  } catch {
    me = null;
  }
  $stats.textContent = meta.stats
    ? `${meta.stats.scripts} scripts · ${meta.stats.releases} releases · ${meta.stats.authors} authors`
    : '';
  await render();
}

boot();
