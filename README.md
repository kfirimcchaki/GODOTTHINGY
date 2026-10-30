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

| Where | What |
| --- | --- |
| `/` | Landing page — "Heeeey, scripting is here!" and the sign-in button |
| `/browse` | Published scripts, with search |
| `/scripts/:id` | Script page: description, author, **Start friendly battle**, release history |
| `/new`, `/editor/:id` | Create a script or edit its Lua source; save and publish |
| `/library` | Your own drafts and published scripts, plus `.lua` upload |
| `/favorites` | Starred scripts |
| `/docs` | The endpoint table, rendered in-app |
| `/s/:token` | A friendly-battle launch page |

The dev provider offers two accounts at `/dev/connect/authorize`: **Beta Tester**
(full access) and **Guest Player** (no battle launching).

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
| `CONNECT_CLIENT_ID` / `CONNECT_CLIENT_SECRET` | — | Real Null's Connect application credentials |
| `CONNECT_AUTHORIZE_URL` / `CONNECT_TOKEN_URL` / `CONNECT_USERINFO_URL` | connect.nulls.gg | Provider endpoints |
| `PUBLIC_URL` | derived from request | Base URL used for redirects and share links |
| `BETA_REQUIRED` | `true` | Gate battle launching behind beta access |
| `DATA_DIR` | `./data` | Where the JSON store lives |

To use the genuine provider, set `AUTH_MODE=connect` plus the four
`CONNECT_*` values and a `CONNECT_REDIRECT_URI` that the provider is configured
to accept.

## Tests

```bash
npm test
```

24 tests drive a real HTTP server over the loopback: the OAuth round trip, the
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

**Not reproduced**, because it is not publicly observable:

- The live frontend's source. `scripting.nulls.gg` ships a client-rendered SPA;
  the interface here is an original implementation of the same screens and
  routes, not a copy of their bundle or stylesheet.
- Response schemas for authenticated routes. Scripting is beta-gated, so
  `/api/me`, the write endpoints and the share payload could not be observed.
  Their shapes here are designed to be consistent with the public ones and are
  flagged as inferred in `docs/API.md`.
- The Lua execution engine. Scripts are stored, versioned and handed out; the
  actual sandbox (Luau, 15 ms per-call CPU budget, 16 MiB cap) lives in the game
  server, which is not part of this repo.

For the Lua-side scripting API — the `server` object, event listeners, the
`updateUIItem` event and the rest — see the upstream reference at
[nulls-mods-community/scripting-docs](https://github.com/nulls-mods-community/scripting-docs).
