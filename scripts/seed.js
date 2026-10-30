/**
 * Seeds the store with the records observed on the live service, so a fresh
 * checkout answers the same requests with the same payloads.
 *
 * The script metadata, release ids and timestamps below were read directly
 * from the public endpoints of scripting.nulls.gg on 2026-10-30.
 */
import db, { save } from '../server/db.js';

const LAB_PROBE = `local done = false

function tick()
    if done then return end
    done = true
    log("LAB_PROBE_OK")
end
`;

const AMONG_US = `-- Among Us MODDED
-- Roles: Sheriff, Jester, Undertaker, Medic, Spy,
--        Enchanter, Hypnoser, Seer, Nice Guesser, Evil Guesser

local roles = {}
local voted = {}

function tick()
    if server.isBattleEnded then return end
    if not server:isIntroFinished() then return end

    for i, character in server.objectManager:getCharacters() do
        if roles[character.index] == nil then
            roles[character.index] = assignRole(character.index)
            log("Role assigned: " .. tostring(roles[character.index]))
        end
    end
end

function assignRole(index)
    local pool = { "Crewmate", "Sheriff", "Jester", "Undertaker", "Medic",
                   "Spy", "Enchanter", "Hypnoser", "Seer",
                   "NiceGuesser", "EvilGuesser", "Impostor" }
    return pool[server:getRandomInt(1, #pool + 1)]
end
`;

const USERS = [
  { user_id: '4572854d-b1b1-406b-82e8-b483998ae0c6', name: 'ReareKit', username: 'rearekit', is_beta: true },
  { user_id: 'a8737f6f-bc1c-486a-b8e7-5deb65fc7e86', name: 'Frumtolur', username: 'frumtolur', is_beta: false },
];

const SCRIPTS = [
  {
    script_id: '01a18307-1527-7454-9557-e96cac0d2448',
    name: 'Among Us MODDED',
    description:
      'Among us v3.0.0, but with Sherrif, Jester, undertaker, medic, spy, enchanter, hypnoser, seer, nice guesser and evil guesser roles',
    user_map_id: 'ef521933-9e64-4408-be9f-aa0888d8dbeb',
    user_map_internal_id: 'CRPJR2C0U:9YGC8UV9RCJ',
    created_at: '2026-10-28T15:00:41.895585Z',
    updated_at: '2026-10-30T11:19:37.121507Z',
    published_at: '2026-10-29T16:10:18.287084Z',
    author_uuid: '4572854d-b1b1-406b-82e8-b483998ae0c6',
    author_name: 'ReareKit',
    code: AMONG_US,
    releases: [
      [15862, '2026-10-28T15:00:41.895585Z'],
      [15887, '2026-10-28T16:13:27.952037Z'],
      [15927, '2026-10-28T18:22:38.652091Z'],
      [15947, '2026-10-28T20:03:38.865711Z'],
      [15948, '2026-10-28T20:11:47.915500Z'],
      [15950, '2026-10-28T20:28:16.378153Z'],
      [15957, '2026-10-28T22:16:35.294546Z'],
      [16083, '2026-10-29T12:18:05.392342Z'],
      [16090, '2026-10-29T12:40:52.589625Z'],
      [16124, '2026-10-29T15:27:07.048787Z'],
      [16126, '2026-10-29T15:33:17.189466Z'],
    ],
  },
  {
    script_id: '01a0f461-d19b-7902-834a-f4a3de66df3d',
    name: 'LabProbe',
    description: null,
    user_map_id: null,
    user_map_internal_id: null,
    created_at: '2026-09-30T22:14:06.491793Z',
    updated_at: '2026-09-30T22:14:36.465213Z',
    published_at: '2026-09-30T22:15:37.285451Z',
    author_uuid: 'a8737f6f-bc1c-486a-b8e7-5deb65fc7e86',
    author_name: 'Frumtolur',
    code: LAB_PROBE,
    releases: [[1024, '2026-09-30T22:14:36.465213Z']],
  },
];

export function ensureSeeded() {
  if (db.isSeeded) return false;

  for (const user of USERS) {
    if (!db.users.some((u) => u.user_id === user.user_id)) {
      db.users.push({ ...user, avatar_url: null, created_at: user.created_at ?? '2026-09-01T00:00:00.000000Z' });
    }
  }

  for (const script of SCRIPTS) {
    const { releases, ...record } = script;
    if (!db.scripts.some((s) => s.script_id === script.script_id)) {
      db.scripts.push(record);
    }
    for (const [id, createdAt] of releases) {
      if (!db.releases.some((r) => r.id === id)) {
        db.releases.push({ id, script_id: script.script_id, description: null, code: script.code, created_at: createdAt });
      }
      db.setReleaseCounter(id + 1);
    }
  }

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
