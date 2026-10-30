# NT Scripting

A self-hostable clone of the `scripting.nulls.gg` web app and its HTTP API — the
front door for writing Lua scripts that run inside Null's Brawl friendly battles.

Sign in, write a script, save it (each save cuts a numbered release), publish it,
and mint a launch link that starts a friendly battle running your game mode.

```bash
npm install
npm start          # http://localhost:3000
```

No database, no build step, no third-party credentials required. State persists
to `data/db.json`, and sign-in runs against a bundled development identity
provider so the whole OAuth round trip works out of the box.

## Quick tour

Routes mirror the live site exactly:

| Where | What |
| --- | --- |
| `/` | Landing — "Heeeey, scripting is here!" and the sign-in button |
| `/scripts` | Script listing, with search |
| `/scripts/:id` | Script page: description, author, **Start friendly battle**, release history |
| `/scripts/:id/edit` | Edit the Lua source; save and publish |
| `/settings` | Sign-in methods (Password / Null's Connect) |
| `/connect` | OAuth — both the launch point and the redirect target |
| `/s/:token` | A friendly-battle launch page |
| anything else | The app's own 404 |

`/scripts/new` reproduces a live quirk: it matches `/scripts/:id`, fails UUID
validation, and renders an inline "Page not found" above the action bar.

The dev provider offers two accounts at `/dev/connect/authorize`: **Beta Tester**
(full access) and **Guest Player** (no battle launching).

## Sign-in

The live site uses the OIDC **implicit** flow, and this implementation matches
it parameter for parameter:

```
https://connect.nulls.gg/authorize?scope=openid+email
  &response_type=id_token
  &redirect_uri=https://scripting.nulls.gg/connect?return_to=%2F
  &client_id=9#sign_up
```

Two things follow from that, and both are reproduced here:

- The credential is a signed JWT (`id_token`) delivered in the **URL fragment**,
  which browsers never send to a server. So `/connect` is a client-side route:
  it reads the fragment and posts the token to `POST /api/auth/session`, which
  verifies it (RS256 against the provider's JWKS, HS256 in mock mode) and sets
  the session cookie.
- The redirect target is `/connect` itself — there is no separate callback path.

## API

Full reference in [`docs/API.md`](docs/API.md) and [`docs/openapi.yaml`](docs/openapi.yaml),
or live at `/docs` on a running instance. The headline routes:

```
GET    /api/health
GET    /api/meta
GET    /api/me
GET    /api/scripts
POST   /api/scripts
GET    /api/scripts/:id
PATCH  /api/scripts/:id
DELETE /api/scripts/:id
PUT    /api/scripts/:id/code
POST   /api/scripts/:id/publish
POST   /api/scripts/:id/share
GET    /api/scripts/:id/releases
POST   /api/scripts/:id/favorite
GET    /api/users/:id
GET    /connect
```

`GET /api/scripts/:id` answers without a session:

```json
{
  "script_id": "01a18307-1527-7454-9557-e96cac0d2448",
  "name": "Among Us MODDED",
  "description": "Among us v3.0.0, but with Sherrif, Jester, undertaker, …",
  "user_map_id": "ef521933-9e64-4408-be9f-aa0888d8dbeb",
  "user_map_internal_id": "CRPJR2C0U:9YGC8UV9RCJ",
  "created_at": "2026-10-28T15:00:41.895585Z",
  "updated_at": "2026-10-30T11:19:37.121507Z",
  "published_at": "2026-10-29T16:10:18.287084Z",
  "author_uuid": "4572854d-b1b1-406b-82e8-b483998ae0c6",
  "author_name": "ReareKit",
  "is_favorite": false
}
```

## Configuration

Copy `.env.example` to `.env`. The interesting switches:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Bind address |
| `AUTH_MODE` | `auto` | `mock` (bundled provider), `connect` (real OAuth), or `auto` |
| `CONNECT_CLIENT_ID` | `9` | OAuth client id — the live site authenticates as `9` |
| `CONNECT_AUTHORIZE_URL` | `https://connect.nulls.gg/authorize` | Provider authorize endpoint |
| `CONNECT_JWKS_URL` | `https://connect.nulls.gg/.well-known/jwks.json` | Keys used to verify the `id_token` |
| `CONNECT_ISSUER` / `CONNECT_AUDIENCE` | `https://connect.nulls.gg` / `9` | Expected `iss` and `aud` claims |
| `PUBLIC_URL` | derived from request | Base URL used for the redirect target and share links |
| `BETA_REQUIRED` | `true` | Gate battle launching behind beta access |
| `DATA_DIR` | `./data` | Where the JSON store lives |

To use the genuine provider, set `AUTH_MODE=connect` and register a redirect URI
of `<your-origin>/connect` with Null's Connect.

## Tests

```bash
npm test
```

27 tests drive a real HTTP server over the loopback: the full OIDC implicit
round trip (including rejection of forged and tampered `id_token`s), the
author/owner permission model, the release counter, the beta gate, and the exact
payload shapes of the public routes.

## What this is, and what it is not

**Reproduced faithfully.** The public endpoint contracts were read directly off
the live service and are asserted in the test suite — including the
microsecond timestamp format, the UUIDv7 id shape, the
`AAAABBBB:CCCCDDDD` internal map id format, and the seeded records for the
script `01a18307-1527-7454-9557-e96cac0d2448` with all eleven of its releases
(`15862` … `16126`). `POST /api/scripts/:id/share` even reproduces the live
behaviour of answering a non-beta caller with `404 {"error":"Script not found"}`
for a script that is published and otherwise readable.

The **route set, page copy and auth flow** were also mapped against the live
site: `/`, `/scripts`, `/scripts/:id`, `/scripts/:id/edit`, `/settings`,
`/connect`, and the app's own 404 for everything else. Routes that do not exist
upstream (`/browse`, `/library`, `/docs`, …) are not served here either. The
landing page is a heading and one button; the 404 page and the sign-in-methods
list on `/settings` use the same wording and structure.

**Not reproduced**, because it is not publicly observable:

- The live frontend's **stylesheet and markup**. `scripting.nulls.gg` ships a
  client-rendered SPA; its bundle and CSS could not be retrieved, so the
  appearance here is an original design. Structure, wording and behaviour match
  — the visual theme does not.
- Response schemas for authenticated routes. Scripting is beta-gated, so
  `/api/me`, the write endpoints and the share payload could not be observed.
  Their shapes here are designed to be consistent with the public ones and are
  flagged as inferred in `docs/API.md`.
- The Lua execution engine. Scripts are stored, versioned and handed out; the
  actual sandbox (Luau, 15 ms per-call CPU budget, 16 MiB cap) lives in the game
  server, which is not part of this repo.
- The exact `id_token` claim names issued by `connect.nulls.gg`. Verification is
  implemented against the standard OIDC claims (`sub`, `name`,
  `preferred_username`, `email`, `picture`); beta entitlement is read from an
  `is_beta` claim that may be named differently upstream.

For the Lua-side scripting API — the `server` object, event listeners, the
`updateUIItem` event and the rest — see the upstream reference at
[nulls-mods-community/scripting-docs](https://github.com/nulls-mods-community/scripting-docs).
