# HTTP API

Base URL: the host serving this app. All responses are JSON unless noted.
Timestamps are UTC with microsecond precision, e.g. `2026-10-28T15:00:41.895585Z`.

Routes marked **verified** were confirmed against the live `scripting.nulls.gg`
service; routes marked **inferred** are behind its beta gate and could not be
observed, so their shapes are designed for consistency with the verified ones.

## Authentication

Sign-in is OAuth 2.0 authorization code via Null's Connect.

```
GET  /connect?return_to=/library   begin the flow (302 to the provider)
GET  /connect/callback             provider redirect target; sets the session cookie
POST /logout                       clear the session
```

Sessions are opaque tokens in an `HttpOnly`, `SameSite=Lax` cookie.
Authenticated routes answer `401 {"error":"Unauthorized"}` without one.

`return_to` accepts only same-origin relative paths; absolute and
protocol-relative values fall back to `/`.

## Objects

### Script

| Field | Type | Notes |
| --- | --- | --- |
| `script_id` | string (UUIDv7) | Time-ordered id |
| `name` | string | ≤ 128 chars |
| `description` | string \| null | ≤ 2048 chars |
| `user_map_id` | string (UUID) \| null | Assigned on first publish |
| `user_map_internal_id` | string \| null | `XXXXXXXXX:YYYYYYYYY`, base32 |
| `created_at` | string | Microsecond UTC |
| `updated_at` | string | Microsecond UTC |
| `published_at` | string \| null | `null` while a draft |
| `author_uuid` | string (UUID) | |
| `author_name` | string | |
| `is_favorite` | boolean | Relative to the caller; `false` when anonymous |

Owners additionally receive `code` (string) and `is_published` (boolean) on the
detail route. No one else ever sees source.

### Release

| Field | Type | Notes |
| --- | --- | --- |
| `id` | integer | Dense, server-wide sequence |
| `description` | string \| null | Release notes |
| `created_at` | string | Microsecond UTC |

Source is only returned by the single-release route, and only to the owner.

### User

| Field | Type |
| --- | --- |
| `user_id` | string (UUID) |
| `name` | string |
| `username` | string |

## Endpoints

### Meta

| Method | Path | Auth | Status | Description |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | no | inferred | `{status, service, time, uptime_seconds}` |
| GET | `/api/meta` | no | inferred | Site capabilities plus counts of scripts, releases and authors |
| GET | `/api/releases` | no | inferred | Global release feed, newest first |

### Scripts

| Method | Path | Auth | Status | Description |
| --- | --- | --- | --- | --- |
| GET | `/api/scripts` | no | inferred | List. `?query`, `?author`, `?favorites`, `?limit` (≤100), `?offset`, `?sort=updated\|created\|name`. Returns `{scripts, total, limit, offset}`. Anonymous callers see published scripts only |
| POST | `/api/scripts` | yes | inferred | Create. JSON `{name, description?, code?}`, or a raw body with `?filename=` for a `.lua` upload. `201` |
| GET | `/api/scripts/:id` | no | **verified** | Script metadata. `404 {"error":"Script not found"}` for unknown ids, malformed ids, and unpublished drafts you do not own |
| PATCH | `/api/scripts/:id` | owner | inferred | Update `name` and/or `description` |
| DELETE | `/api/scripts/:id` | owner | inferred | Removes the script, its releases and its favorites. `204` |
| PUT | `/api/scripts/:id/code` | owner | inferred | Save source; appends a release. Returns the script plus `release` |
| GET | `/api/scripts/:id/code` | owner | inferred | `{script_id, code, updated_at}` |

### Publishing and launching

| Method | Path | Auth | Status | Description |
| --- | --- | --- | --- | --- |
| POST | `/api/scripts/:id/publish` | owner | inferred | Sets `published_at` and, on first publish, assigns `user_map_id` and `user_map_internal_id` |
| POST | `/api/scripts/:id/unpublish` | owner | inferred | Clears `published_at` |
| POST | `/api/scripts/:id/share` | owner + beta | **verified (error path)** | Mints a friendly-battle launch link. `201 {share_url, launch_url, script_id, release_id, expires_at}` |
| GET | `/api/scripts/:id/share` | owner | inferred | Lists recent launch links |

**The beta gate.** On the live service, scripting is limited to beta testers, and
a caller without that entitlement receives `404 {"error":"Script not found"}`
from `/share` even for a published script that is publicly readable. This
implementation reproduces that exactly: the handler resolves a script only when
the caller both owns it and holds beta access, so the denied case is
indistinguishable from a genuinely missing script. Set `BETA_REQUIRED=false` to
lift the gate.

### Releases

| Method | Path | Auth | Status | Description |
| --- | --- | --- | --- | --- |
| GET | `/api/scripts/:id/releases` | no | **verified** | `{releases:[{id, description, created_at}]}`, ascending by id |
| GET | `/api/scripts/:id/releases/:releaseId` | owner | inferred | One release including `code` |

### Users and favorites

| Method | Path | Auth | Status | Description |
| --- | --- | --- | --- | --- |
| GET | `/api/users/:id` | no | **verified** | `{user_id, name, username}` — exactly three fields |
| GET | `/api/users/:id/scripts` | no | inferred | `{user, scripts}` |
| GET | `/api/favorites` | yes | inferred | `{scripts:[…]}` |
| POST | `/api/scripts/:id/favorite` | yes | inferred | `{script_id, is_favorite:true}`; idempotent |
| DELETE | `/api/scripts/:id/favorite` | yes | inferred | `{script_id, is_favorite:false}`; idempotent |

### Pages

| Path | Description |
| --- | --- |
| `/s/:token` | Friendly-battle launch page for a share token |
| any other unmatched path | The SPA shell, which renders its own 404 |

## Errors

```json
{ "error": "Script not found" }
```

| Status | Meaning |
| --- | --- |
| 400 | Validation failure, malformed JSON, bad OAuth state |
| 401 | No session |
| 404 | Missing resource — or a resource you may not see |
| 413 | Body over the size limit |
| 502 | OAuth exchange with the provider failed |

Unmatched `/api/*` routes return `404 {"error":"Not found"}` as JSON rather than
the SPA shell.

## Scripting limits

Carried in `/api/meta` so clients can surface them:

| Limit | Value |
| --- | --- |
| Maximum source size | 512 KiB per script |
| Client events | 20 per second per battle |

The Lua runtime itself is sandboxed per script with a 15 ms per-call CPU budget
and a 16 MiB memory cap; that enforcement lives in the game server, not here.
