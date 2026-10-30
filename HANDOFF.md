# Handoff: rebuilding scripting.nulls.gg in the correct repository

Everything below was verified against the live service on **2026-10-30** by
probing it directly. Part 1 is the contract. Part 2 is a prompt you can paste
straight into a new Arena agent.

> **Note on the current work.** The full clone already exists on branch
> `arena/318a3026-godotthingy` of `kfirimcchaki/GODOTTHINGY` (PR #1). It is
> complete and its 27-test suite passes, but that is the wrong repo. A new
> agent does not have to start from scratch — it can read that branch over
> GitHub (which is reachable from the sandbox) and port the code across. The
> two files worth lifting verbatim are `scripts/seed-data.js` (65 real scripts
> with real timestamps) and `tests/api.test.js`.

---

# Part 1 — The contract

## 1. Basic facts

| | |
| --- | --- |
| Reference URL | `https://scripting.nulls.gg/scripts/01a18307-1527-7454-9557-e96cac0d2448` |
| Site | `https://scripting.nulls.gg` — client-rendered SPA, no server-side HTML |
| Identity provider | `https://connect.nulls.gg` — "Null's Connect 1.3.3" |
| Parent project | `https://nulls.gg` (Null's Brawl private server) |
| Docs repo | `https://github.com/nulls-mods-community/scripting-docs` (**no LICENSE** — link, don't copy) |
| Access | Beta-gated. Scripting is only usable by beta accounts. |

**Timestamps:** RFC3339 UTC, always **6 fractional digits**, trailing `Z` —
`2026-10-29T16:10:18.287084Z`. Never 3 digits, never an offset.

**Script ids:** UUIDv7 — `01a18307-1527-7454-9557-e96cac0d2448`. Version
nibble is `7`, variant nibble is `8|9|a|b`.

**User map internal id:** two 9-char base32 groups separated by a colon —
`CRPJR2C0U:9YGC8UV9RCJ`.

## 2. Page routes (probed exhaustively)

**Real:**

| Path | Renders |
| --- | --- |
| `/` | H1 `Heeeey, scripting is here!`, then one link: a 32×32 `![Null's Connect](/nulls-connect-32.png)` icon plus the text `Continue with Null's Connect`. Nothing else. |
| `/scripts` | Loading state only (async) |
| `/scripts/:uuid` | `Start friendly battle` button + `## Releases` |
| `/scripts/:uuid/edit` | Loading state only (async) |
| `/settings` | H1 `Settings`, H2 `Sign in methods`; list items — H3 `Password` / `Not configured` / `Change password`; H3 `Null's Connect` / link `Connect` → `/connect?return_to=%2Fsettings` |
| `/connect` | OAuth (see §5) |

**404 upstream — do not build these:** `/editor`, `/me`, `/profile`, `/browse`,
`/library`, `/docs`, `/new`.

**Quirk:** `/scripts/new` matches the `:uuid` route, fails UUID validation, and
renders an inline `Page not found` *above* the action bar rather than replacing
the page. Reproduce it.

**404 page copy**, in this order: `Page not found` / `The page you are looking
for does not exist or has been moved.` / `Go to homepage` link / `404`.
Every unmatched path — `/robots.txt` included — serves the SPA shell with 200,
and the client router draws the 404.

## 3. Public API — verified verbatim

### `GET /api/scripts/:script_id` → 200, no auth

Eleven fields, in this order:

```json
{"script_id":"01a18307-1527-7454-9557-e96cac0d2448","name":"Among Us MODDED",
 "description":"Among us v3.0.0, but with Sherrif, Jester, undertaker, medic, spy, enchanter, hypnoser, seer, nice guesser and evil guesser roles",
 "user_map_id":"ef521933-9e64-4408-be9f-aa0888d8dbeb",
 "user_map_internal_id":"CRPJR2C0U:9YGC8UV9RCJ",
 "created_at":"2026-10-28T15:00:41.895585Z","updated_at":"2026-10-30T11:19:37.121507Z",
 "published_at":"2026-10-29T16:10:18.287084Z",
 "author_uuid":"4572854d-b1b1-406b-82e8-b483998ae0c6","author_name":"ReareKit","is_favorite":false}
```

`description`, `user_map_id`, `user_map_internal_id` may be `null`.
**Most published scripts have `user_map_id: null`** — publishing does *not*
bind a user map. Only 2 of 65 do, and those are the ones that have been
launched. Bind it on first share.

### `GET /api/scripts/:script_id/releases` → 200, no auth

```json
{"releases":[{"id":15862,"description":null,"created_at":"2026-10-28T15:00:41.895585Z"}]}
```

Ascending by `id`. `id` is a **single globally increasing integer** across all
scripts (a Sept 4 script starts at 1860; an Oct 28 script starts at 15862).
Creating a script cuts release #1 at the exact same microsecond as
`created_at`.

Two release lists captured in full:

- `01a18307…` (Among Us MODDED): `15862, 15887, 15927, 15947, 15948, 15950, 15957, 16083, 16090, 16124, 16126`
- `01a06c4c-5697-7e94-a070-849f50779d0b` (Among Us v1.5.4): `1860, 1861, 1975, 2055, 2105, 2125, 5516, 5569, 6626, 6633, 8448, 8450`

### `GET /api/users/:user_id` → 200, no auth

Exactly three fields:

```json
{"user_id":"4572854d-b1b1-406b-82e8-b483998ae0c6","name":"ReareKit","username":"rearekit"}
```

### `GET /api/users/:user_id/scripts` → 200, no auth

This one is **public** and easy to get wrong. It returns the author plus a
**nine-field** item shape — `user_map_id` and `user_map_internal_id` are
**omitted entirely**, unlike the detail route:

```json
{"user":{"user_id":"...","name":"ReareKit","username":"rearekit"},
 "scripts":[{"script_id":"01a0328d-96df-7a43-85ea-6d5e04822b0f","name":"Spawn Box On Pin",
   "description":null,"created_at":"2026-08-24T06:55:35.135305Z",
   "updated_at":"2026-08-25T18:49:49.249230Z","published_at":"2026-08-24T13:01:46.788803Z",
   "author_uuid":"4572854d-b1b1-406b-82e8-b483998ae0c6","author_name":"ReareKit",
   "is_favorite":false}]}
```

Unpaginated. Sorted **ascending by `created_at`**. Published only (owner sees
own drafts).

## 4. Authenticated API — inferred, never directly observed

These exist but return an **empty body** to an unauthenticated GET, so they are
auth-gated and their schemas are inference:

`/api/me`, `/api/user`, `/api/scripts` (supports `?query=`), `/api/releases`,
`/api/health`, `/api/scripts/:id/code`, `/api/scripts/:id/releases/:releaseId`,
`/api/authors/:uuid`, `/api/favorites`.

Write endpoints, per
[scripting-docs issue #12](https://github.com/nulls-mods-community/scripting-docs/issues/12):

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/scripts` | JSON `{name, description?, code?}`, **or** a raw `.lua` body with `?filename=` |
| PATCH | `/api/scripts/:id` | rename / change description |
| DELETE | `/api/scripts/:id` | owner only |
| PUT | `/api/scripts/:id/code` | saves source, cuts a new release |
| POST | `/api/scripts/:id/publish` | sets `published_at`; **does not** set `user_map_id` |
| POST | `/api/scripts/:id/unpublish` | |
| POST | `/api/scripts/:id/share` | see below |
| POST/DELETE | `/api/scripts/:id/favorite` | |
| POST | `/logout` | |

**`POST /api/scripts/:id/share` is beta-gated and reproduces a specific live
quirk:** a caller without beta access gets `404 {"error":"Script not found"}`
— *even for a script that is published and otherwise readable*. Return
`201` with `{share_url, launch_url, script_id, release_id, expires_at}` where
`launch_url` is `nullsbrawl://scripting/play?token=<token>`.

Unpublished scripts are author-only; strangers get the same 404 shape as an
unknown id.

## 5. Authentication — OIDC implicit, not authorization code

This is the single most common mistake. `GET /connect?return_to=%2F` 302s to:

```
https://connect.nulls.gg/authorize?scope=openid+email
  &response_type=id_token
  &redirect_uri=https%3A%2F%2Fscripting.nulls.gg%2Fconnect%3Freturn_to%3D%252F
  &client_id=9#sign_up
```

- `client_id` is literally **`9`**.
- `response_type=id_token` — the credential is a **signed JWT in the URL
  fragment**, which browsers never send to a server.
- The redirect target is **`/connect` itself**. There is **no**
  `/connect/callback`, no token endpoint, no userinfo endpoint.
- The provider appends the fragment `#sign_up`.

So `/connect` must be **client-side**: with no fragment, redirect to the
provider; with an `#id_token` fragment, `POST` it to `/api/auth/session`, which
verifies the JWT and sets the session cookie, then honours `return_to`.

`id_token` verification: check `alg`, signature (RS256 against the provider
JWKS; HS256 for a local mock), `exp`, `iat`, `iss`, `aud`. Reject with
`401 {"error":"Invalid id_token"}`; a missing token gives
`400 {"error":"Missing id_token"}`.

Claims used: `sub`, `name`, `preferred_username`, `email`, `picture`, plus an
`is_beta` claim for the beta entitlement (**upstream's actual claim name is
unverified** — scripting is beta-gated so no real token was observable).

Provider UI copy, if you want to mock it faithfully: `Sign in` /
`Enter your email address` / `Proceed`; `Enter login code` — "We've just sent a
login code to…"; `One more step` — "You need to agree to our rules and terms of
use:"; `Choose an account` — "You haven't linked any game accounts yet" /
`Link current account`; `Settings` — Sign out of all devices / Transfer
accounts / "Telegram: not connected" / Import accounts from VKontakte;
`Public profile` — Unique handle, "Sadly, you can't change your handle now.
Come back tomorrow!"; `External authentication` — "wants to authenticate with
your account. It will get basic information about your account, including your
email address".

## 6. The catalogue — 65 real scripts, 2 authors

Harvested from `/api/users/:id/scripts` and `/api/scripts/:id`. **Names and
descriptions are verbatim, including the original author's typos**
("Immortallity", "Sents the map code", "Andriod only", "VInce, Bolt and Finx
banned"). Keep them — they are what make the clone look real.

- **ReareKit** `4572854d-b1b1-406b-82e8-b483998ae0c6` / `rearekit` — 62 scripts,
  Aug 24 → Oct 30 2026. Beta.
- **Frumtolur** `a8737f6f-bc1c-486a-b8e7-5deb65fc7e86` / `frumtolur` — 3 scripts,
  Sep 30 2026. One has a Russian name and description (`Проверка координат`).

The complete dataset with every timestamp is committed at
**`scripts/seed-data.js`** on branch `arena/318a3026-godotthingy` of
`kfirimcchaki/GODOTTHINGY`. Port that file rather than re-deriving it.

## 7. Lua scripting API (runs in the game server, not the website)

From `nulls-mods-community/scripting-docs`: 20 ticks/sec; global `tick()` entry
point; globals `server` and `objectManager`; `event()` for UI events capped at
20/sec; CPU budget ≤15 ms per call; memory ≤16 MiB. Example of a real UI event
call: `event("updateUIItem", { tomplId = "nt_button_blue", ... })`.

## 8. What cannot be reproduced — say so rather than faking it

1. **Their stylesheet and markup.** This is the hard blocker on visual
   fidelity. The bundle and CSS were never obtained. Appearance will be an
   original design; structure, copy, routing and behaviour can match.
2. **Their logo.** `/nulls-connect-32.png` returns HTTP 500 to a fetcher. Use a
   generated 32×32 placeholder.
3. **Authed response schemas.** Beta-gated, so unobservable.
4. **The exact `is_beta` claim name.**
5. **The Lua execution engine** (the actual Luau sandbox lives in the game
   server).

## 9. Sandbox gotchas for whoever builds this

- **`curl` cannot reach `scripting.nulls.gg`** — TLS reset. Egress is limited to
  `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`,
  `pypi.org`, `files.pythonhosted.org`. All site probing must go through
  `fetch_page`.
- `fetch_page` is **GET-only** — POST/PUT/DELETE behaviour can only be inferred.
- `fetch_page` returns data in **character-contiguous chunks**; you can
  concatenate them and re-parse as JSON to harvest large payloads.
- **`node --test tests/` does not accept a directory** on Node 22 — use
  `node --test tests/*.test.js`.
- **PyYAML cannot be installed** (PEP 668 externally-managed). Use npm `yaml`
  for YAML validation.
- `better-sqlite3` needs a native build — avoid; a JSON file store works fine.
- Already tried and failed, do not retry: `r.jina.ai`, `api.allorigins.win`,
  `api.codetabs.com`, `corsproxy.io`, Wayback Machine (never archived),
  `urlscan.io` (0 results), `crt.sh` (502), GitHub code search for
  `scripting.nulls.gg` (0 hits).

---

# Part 2 — Prompt to paste into a new Arena agent

````
Build a complete, faithful clone of https://scripting.nulls.gg as a runnable
live website, and commit it to my repository. The reference page is
https://scripting.nulls.gg/scripts/01a18307-1527-7454-9557-e96cac0d2448

It must match the original end to end: every endpoint, every JSON shape, every
page, the routing, the copy, and the sign-in flow. Do not invent screens or
endpoints that the original does not have.

IMPORTANT — a previous attempt already exists and much of it is correct. Before
writing anything, read branch `arena/318a3026-godotthingy` of
`kfirimcchaki/GODOTTHINGY` (github.com is reachable). Port these across rather
than starting over:
  - scripts/seed-data.js  — 65 real scripts with verbatim names, descriptions
    and microsecond timestamps. Use as-is.
  - tests/api.test.js     — 27 contract tests. Keep them all passing.
Then re-read this brief and correct the code against it.

=== ROUTES THAT EXIST (build exactly these) ===
  /                     H1 "Heeeey, scripting is here!" + one link: a 32x32
                        Null's Connect icon and the text
                        "Continue with Null's Connect". Nothing else.
  /scripts              script listing
  /scripts/:uuid        "Start friendly battle" button + "## Releases"
  /scripts/:uuid/edit   editor
  /settings             H1 "Settings", H2 "Sign in methods"; list items:
                        H3 "Password" / "Not configured" / "Change password";
                        H3 "Null's Connect" / link "Connect" ->
                        /connect?return_to=%2Fsettings
  /connect              OAuth (client-side, see below)
DO NOT BUILD: /editor /me /profile /browse /library /docs /new — all 404 upstream.
Quirk to reproduce: /scripts/new matches the :uuid route, fails UUID
validation, and renders an inline "Page not found" ABOVE the action bar.
404 copy and order: "Page not found" / "The page you are looking for does not
exist or has been moved." / "Go to homepage" / "404". Every unmatched path
(including /robots.txt) serves the SPA shell with 200; the client router
renders the 404.

=== PUBLIC API (verified live) ===
GET /api/scripts/:id  -> 200, 11 fields in this order:
  script_id, name, description, user_map_id, user_map_internal_id,
  created_at, updated_at, published_at, author_uuid, author_name, is_favorite
  description/user_map_id/user_map_internal_id may be null.
  MOST published scripts have user_map_id = null (only 2 of 65 have one).
  Publishing must NOT set it. Bind it on first share.

GET /api/scripts/:id/releases -> 200
  {"releases":[{"id":15862,"description":null,"created_at":"..."}]}
  Ascending by id. id is a single GLOBAL increasing integer across all scripts
  (a Sept 4 script starts at 1860; an Oct 28 one starts at 15862). Creating a
  script cuts release #1 at the exact microsecond of created_at.

GET /api/users/:id -> 200, EXACTLY three fields: user_id, name, username.

GET /api/users/:id/scripts -> 200, PUBLIC
  {"user":{user_id,name,username},"scripts":[...]}
  The items here are NINE fields — user_map_id and user_map_internal_id are
  OMITTED, unlike the detail route. This is easy to get wrong.
  Unpaginated, sorted ASCENDING by created_at, published only (owner sees drafts).

Timestamps: RFC3339 UTC with EXACTLY 6 fractional digits, trailing Z.
Script ids: UUIDv7. user_map_internal_id: two 9-char base32 groups, colon-
separated, e.g. CRPJR2C0U:9YGC8UV9RCJ.

=== AUTHENTICATED API (inferred — empty body to anonymous GET) ===
/api/me, /api/user, /api/scripts (supports ?query=), /api/releases,
/api/health, /api/scripts/:id/code, /api/scripts/:id/releases/:releaseId,
/api/authors/:uuid, /api/favorites
Writes: POST /api/scripts (JSON or raw .lua with ?filename=),
PATCH|DELETE /api/scripts/:id, PUT /api/scripts/:id/code (cuts a release),
POST /api/scripts/:id/publish, /unpublish, /share, POST|DELETE /favorite,
POST /logout.
Reproduce this live quirk exactly: POST /api/scripts/:id/share without beta
access returns 404 {"error":"Script not found"} EVEN for a published, readable
script. Success returns 201 with share_url, launch_url
(nullsbrawl://scripting/play?token=...), script_id, release_id, expires_at.
Unpublished scripts are author-only; strangers get the same 404 shape.

=== SIGN-IN: OIDC IMPLICIT — not authorization code ===
GET /connect?return_to=%2F 302s to:
  https://connect.nulls.gg/authorize?scope=openid+email
    &response_type=id_token
    &redirect_uri=<site>/connect?return_to=%2F
    &client_id=9#sign_up
client_id is literally "9". The credential is a signed JWT in the URL FRAGMENT,
which browsers never send to a server. The redirect target is /connect ITSELF —
there is NO /connect/callback, no token endpoint, no userinfo endpoint.
So /connect is client-side: no fragment -> redirect to the provider; with an
#id_token fragment -> POST it to /api/auth/session, which verifies (RS256 via
provider JWKS; HS256 for a local mock) and sets the session cookie, then
honours return_to. Check alg, signature, exp, iat, iss, aud.
401 {"error":"Invalid id_token"}; 400 {"error":"Missing id_token"}.
Claims: sub, name, preferred_username, email, picture, is_beta (upstream's real
claim name is unverified — say so in the README).

=== LUA API (documentation only; execution is in the game server) ===
20 ticks/sec, global tick(), globals server and objectManager, event() capped
at 20/sec, CPU <=15 ms per call, memory <=16 MiB.

=== CONSTRAINTS ===
- curl CANNOT reach scripting.nulls.gg (TLS reset). Egress is limited to
  github.com, api.github.com, codeload.github.com, registry.npmjs.org,
  pypi.org, files.pythonhosted.org. Probe the site with fetch_page only.
- fetch_page is GET-only, so write endpoints stay inferred.
- No native deps (better-sqlite3 fails to build). Use a JSON file store.
- node --test needs a glob: `node --test tests/*.test.js`.
- PyYAML is not installable (PEP 668); use npm `yaml` to validate YAML.

=== BE HONEST ABOUT WHAT YOU CANNOT MATCH ===
You will not obtain their CSS, JS bundle, or logo — the site is a client-
rendered SPA and every proxy attempt failed (r.jina.ai, allorigins, codetabs,
corsproxy, Wayback which never archived it, urlscan, crt.sh). Do not retry
these. So state plainly in the README that the visual theme is an original
design while structure, copy, routing and behaviour match. Also flag the
authed schemas and the is_beta claim name as inferred. Do not present inferred
things as verified.

Deliver: a runnable site (give me a live preview), the full test suite passing,
a README documenting the contract and the gaps, and a pull request. Do not
merge it.
````
