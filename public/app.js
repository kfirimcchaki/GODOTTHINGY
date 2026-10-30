/* NT Scripting — single page app.
 *
 * Route set mirrors the live site:
 *   /                    landing
 *   /scripts             listing
 *   /scripts/:id         script page
 *   /scripts/:id/edit    editor
 *   /settings            sign-in methods
 *   /connect             OAuth (OIDC implicit, handled here because the
 *                        id_token arrives in the URL fragment)
 * Anything else renders the app's 404.
 */

const $view = document.getElementById('view');
const $nav = document.getElementById('nav');
const $session = document.getElementById('session');
const $toasts = document.getElementById('toast-host');

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

let me = null;
let meta = {
  site_name: 'NT Scripting',
  auth_mode: 'mock',
  login_path: '/connect',
  beta_required: true,
  oauth: { authorize_url: '/dev/connect/authorize', client_id: '9', response_type: 'id_token', scope: 'openid email', fragment: '' },
};

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
      ...(options.body && !options.raw ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : options.raw ? options.body : JSON.stringify(options.body),
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

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

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

function renderChrome(pathname) {
  const links = [['/scripts', 'Scripts'], ['/settings', 'Settings']];
  $nav.innerHTML = links
    .map(([href, label]) => `<a href="${href}" data-link class="${pathname.startsWith(href) ? 'active' : ''}">${label}</a>`)
    .join('');

  if (me) {
    $session.innerHTML = `
      <span class="whoami">${esc(me.name)}${me.is_beta ? '<span class="beta">beta</span>' : ''}</span>
      <button class="btn small" id="logout">Sign out</button>`;
    document.getElementById('logout').onclick = async () => {
      await api('/logout', { method: 'POST' });
      me = null;
      navigate('/');
    };
  } else {
    $session.innerHTML = `<a class="btn small" href="/connect?return_to=${encodeURIComponent(pathname)}" data-link>Sign in</a>`;
  }
}

/* ------------------------------------------------------------------ *
 * Screens
 * ------------------------------------------------------------------ */

// Landing: a heading and the sign-in button, nothing else.
function screenHome() {
  if (me) return screenLibrary();
  return `
  <div class="hero">
    <h1>Heeeey, scripting is here!</h1>
    <a class="btn primary connect-btn" href="/connect?return_to=%2F" data-link>
      <img src="/nulls-connect-32.png" alt="Null's Connect" width="32" height="32">
      Continue with Null's Connect
    </a>
  </div>`;
}

// Signed-in home: your own scripts, with the "+" affordance.
function screenLibrary() {
  return `
  <div class="page-head">
    <div><h1>Your scripts</h1></div>
    <div class="actions">
      <label class="btn" style="margin:0">Upload .lua<input type="file" id="upload" accept=".lua,.luau,.txt" hidden></label>
      <button class="btn primary" id="create">+</button>
    </div>
  </div>
  <div id="results"><div class="skeleton"></div></div>`;
}

async function hydrateLibrary() {
  document.getElementById('create').onclick = async () => {
    const name = prompt('Script name');
    if (!name) return;
    try {
      const created = await api('/api/scripts', { method: 'POST', body: { name, code: STARTER } });
      navigate(`/scripts/${created.script_id}/edit`);
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  document.getElementById('upload').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const created = await api(`/api/scripts?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        raw: true,
        headers: { 'content-type': 'text/plain' },
        body: await file.text(),
      });
      navigate(`/scripts/${created.script_id}/edit`);
    } catch (err) {
      toast(err.message, 'err');
    }
  });

  try {
    const { scripts } = await api(`/api/users/${me.user_id}/scripts`);
    document.getElementById('results').innerHTML = scripts.length
      ? `<div class="grid">${scripts.map(ownCardHtml).join('')}</div>`
      : `<div class="empty">No scripts yet. Use “+” to create one, or upload a .lua file.</div>`;
  } catch (err) {
    document.getElementById('results').innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

function screenScripts() {
  return `
  <div class="page-head"><div><h1>Scripts</h1></div>
    <div class="field" style="margin:0;min-width:220px"><input type="text" id="search" placeholder="Search…"></div>
  </div>
  <div id="results">Loading...</div>`;
}

async function hydrateScripts() {
  const input = document.getElementById('search');
  const load = async () => {
    const q = encodeURIComponent(input.value.trim());
    try {
      const { scripts } = await api(`/api/scripts?limit=60${q ? `&query=${q}` : ''}`);
      document.getElementById('results').innerHTML = scripts.length
        ? `<div class="grid">${scripts.map(cardHtml).join('')}</div>`
        : `<div class="empty">Nothing here yet.</div>`;
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

function cardHtml(script) {
  return `
  <a class="script-card" href="/scripts/${esc(script.script_id)}" data-link>
    <h3>${esc(script.name)}</h3>
    <p class="desc">${esc(script.description || 'No description.')}</p>
    <div class="meta"><span>by ${esc(script.author_name)}</span><span>·</span><span>${fmtDate(script.updated_at)}</span></div>
  </a>`;
}

function ownCardHtml(script) {
  return `
  <div class="script-card">
    <h3><a href="/scripts/${esc(script.script_id)}" data-link>${esc(script.name)}</a></h3>
    <p class="desc">${esc(script.description || 'No description.')}</p>
    <div class="meta">
      <span class="badge ${script.published_at ? 'published' : 'draft'}">${script.published_at ? 'published' : 'draft'}</span>
      <span>${fmtDate(script.updated_at)}</span>
    </div>
    <div class="actions">
      <a class="btn small" href="/scripts/${esc(script.script_id)}/edit" data-link>Edit</a>
      <button class="btn small danger" data-delete="${esc(script.script_id)}">Delete</button>
    </div>
  </div>`;
}

async function screenScript(id) {
  if (!new RegExp(`^${UUID}$`, 'i').test(id)) {
    // Matches the live behaviour for /scripts/new: an inline notice, with the
    // action bar still rendered underneath.
    return `
    <p>Page not found</p>
    <div class="actions"><button class="btn primary" id="share" disabled>Start friendly battle</button></div>
    <h2>Releases</h2>
    <div class="empty">No releases.</div>`;
  }

  let script;
  try {
    script = await api(`/api/scripts/${id}`);
  } catch (err) {
    return notFound();
  }
  const { releases } = await api(`/api/scripts/${id}/releases`);
  const isOwner = me && me.user_id === script.author_uuid;

  return `
  <div class="page-head">
    <div>
      <h1>${esc(script.name)}</h1>
      <div class="actions">
        <span class="badge ${script.published_at ? 'published' : 'draft'}">${script.published_at ? 'published' : 'draft'}</span>
        <span class="muted small">by ${esc(script.author_name)}</span>
      </div>
    </div>
    <div class="actions">
      ${isOwner ? `<a class="btn" href="/scripts/${esc(script.script_id)}/edit" data-link>Edit</a>` : ''}
      <button class="btn primary" id="share">Start friendly battle</button>
    </div>
  </div>

  ${script.description ? `<p class="muted">${esc(script.description)}</p>` : ''}
  <div id="share-result"></div>

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

  ${script.code !== undefined ? `<h2>Source</h2><pre class="code-block">${esc(script.code)}</pre>` : ''}`;
}

async function hydrateScript(id) {
  const shareButton = document.getElementById('share');
  if (!shareButton || shareButton.disabled) return;

  shareButton.onclick = async () => {
    if (!me) return navigate(`/connect?return_to=${encodeURIComponent(location.pathname)}`);
    const host = document.getElementById('share-result');
    shareButton.disabled = true;
    try {
      const result = await api(`/api/scripts/${id}/share`, { method: 'POST' });
      host.innerHTML = `<div class="notice">Launch link created.
        <div class="actions" style="margin-top:9px">
          <a class="btn small primary" href="${esc(result.launch_url)}">Open in Null's Brawl</a>
          <code class="mono">${esc(result.share_url)}</code>
        </div></div>`;
    } catch (err) {
      host.innerHTML = `<div class="error-box">${esc(err.message)}${
        err.status === 404 && meta.beta_required ? ' — starting a battle currently requires beta access.' : ''
      }</div>`;
    } finally {
      shareButton.disabled = false;
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
  if (!me) {
    return `<div class="notfound"><h1>Sign in required</h1>
      <p class="muted">Sign in to edit scripts.</p>
      <a class="btn primary connect-btn" href="/connect?return_to=${encodeURIComponent(location.pathname)}" data-link>
        <img src="/nulls-connect-32.png" alt="Null's Connect" width="32" height="32"> Continue with Null's Connect</a></div>`;
  }
  let script;
  try {
    script = await api(`/api/scripts/${id}`);
  } catch {
    return notFound();
  }
  if (script.code === undefined) return `<div class="error-box">You can only edit scripts you own.</div>`;

  return `
  <div class="page-head">
    <div><h1>${esc(script.name)}</h1>
      <div class="actions">
        <span class="badge ${script.published_at ? 'published' : 'draft'}" id="pub-badge">${script.published_at ? 'published' : 'draft'}</span>
        <a class="muted small" href="/scripts/${esc(script.script_id)}" data-link>View script page</a>
      </div>
    </div>
    <div class="actions">
      <button class="btn" id="save">Save</button>
      <button class="btn primary" id="publish">${script.published_at ? 'Republish' : 'Publish'}</button>
    </div>
  </div>
  <div class="field"><label for="name">Name</label><input type="text" id="name" value="${esc(script.name)}" maxlength="128"></div>
  <div class="field"><label for="description">Description</label><input type="text" id="description" value="${esc(script.description || '')}" maxlength="2048"></div>
  <div class="field"><label for="code">script.lua</label><textarea class="code" id="code" spellcheck="false">${esc(script.code)}</textarea></div>
  <div class="small faint"><span id="status"></span></div>`;
}

async function hydrateEditor(id) {
  const status = document.getElementById('status');
  const code = document.getElementById('code');
  if (!code) return;

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
        body: { name: document.getElementById('name').value, description: document.getElementById('description').value || null },
      });
      const result = await api(`/api/scripts/${id}/code`, { method: 'PUT', body: { code: code.value } });
      status.textContent = `Saved — release #${result.release.id}`;
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

// Settings: the live page lists sign-in methods only.
function screenSettings() {
  return `
  <h1>Settings</h1>
  <h2>Sign in methods</h2>
  <ul class="methods">
    <li>
      <h3>Password</h3>
      <p class="muted">Not configured</p>
      <button class="btn small" id="change-password">Change password</button>
    </li>
    <li>
      <h3>Null's Connect</h3>
      <p class="muted">${me ? `Signed in as ${esc(me.name)}` : 'Not connected'}</p>
      <a class="btn small" href="/connect?return_to=%2Fsettings" data-link>Connect</a>
    </li>
  </ul>`;
}

function hydrateSettings() {
  document.getElementById('change-password').onclick = () =>
    toast('Password sign-in is not configured on this deployment.', 'err');
}

/* ------------------------------------------------------------------ *
 * OAuth — OIDC implicit flow
 *
 * The id_token comes back in the URL fragment, which the server never sees,
 * so this route posts it to /api/auth/session and then honours return_to.
 * ------------------------------------------------------------------ */

function buildAuthorizeUrl(returnTo) {
  const o = meta.oauth;
  const params = new URLSearchParams({
    scope: o.scope,
    response_type: o.response_type,
    redirect_uri: `${location.origin}/connect?return_to=${encodeURIComponent(returnTo)}`,
    client_id: o.client_id,
  });
  return `${o.authorize_url}?${params}${o.fragment || ''}`;
}

function safeReturnTo(value) {
  const target = String(value || '/');
  return target.startsWith('/') && !target.startsWith('//') ? target : '/';
}

async function screenConnect() {
  const params = new URLSearchParams(location.search);
  const returnTo = safeReturnTo(params.get('return_to'));
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const idToken = fragment.get('id_token');

  if (location.hash) history.replaceState({}, '', location.pathname + location.search);

  if (!idToken) {
    location.replace(buildAuthorizeUrl(returnTo));
    return `<div class="empty">Redirecting to Null's Connect…</div>`;
  }

  try {
    me = await api('/api/auth/session', { method: 'POST', body: { id_token: idToken } });
    navigate(returnTo, true);
    return '';
  } catch (err) {
    return `<div class="notfound"><h1>Sign-in failed</h1><p class="muted">${esc(err.message)}</p>
      <a class="btn" href="/" data-link>Go to homepage</a></div>`;
  }
}

function notFound() {
  return `<div class="notfound">
    <h1>Page not found</h1>
    <p class="muted">The page you are looking for does not exist or has been moved.</p>
    <p><a class="btn" href="/" data-link>Go to homepage</a></p>
    <p class="code">404</p>
  </div>`;
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

const ROUTES = [
  [/^\/$/, screenHome, (m) => (me ? hydrateLibrary() : null)],
  [/^\/scripts$/, screenScripts, hydrateScripts],
  [/^\/settings$/, screenSettings, hydrateSettings],
  [/^\/connect$/, screenConnect, null],
  [/^\/scripts\/([^/]+)\/edit$/, screenEditor, hydrateEditor],
  [/^\/scripts\/([^/]+)$/, screenScript, hydrateScript],
];

async function render() {
  const pathname = location.pathname;
  renderChrome(pathname);
  window.scrollTo(0, 0);

  for (const [pattern, screen, hydrate] of ROUTES) {
    const match = pathname.match(pattern);
    if (!match) continue;
    $view.innerHTML = 'Loading...';
    const html = await screen(...match.slice(1));
    $view.innerHTML = html;
    if (hydrate) await hydrate(...match.slice(1));
    return;
  }
  $view.innerHTML = notFound();
}

async function boot() {
  try {
    meta = { ...meta, ...(await api('/api/meta')) };
  } catch {
    /* keep defaults */
  }
  try {
    me = await api('/api/me');
  } catch {
    me = null;
  }
  await render();
}

boot();
