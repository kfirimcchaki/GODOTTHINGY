/**
 * Catalogue captured from the live service on 2026-10-30.
 *
 * Every record below was read off public endpoints:
 *   GET /api/users/:id/scripts   -> the catalogue (9-field items)
 *   GET /api/scripts/:id         -> the detail record (adds user_map_*)
 *   GET /api/scripts/:id/releases-> the release list
 *
 * `releases` is only populated where the live release list was captured; for
 * everything else the seeder synthesises releases from created_at/updated_at
 * and interpolates an id from RELEASE_ID_ANCHORS (see scripts/seed.js).
 *
 * Names, descriptions and timestamps are verbatim, including the original
 * author's typos ("Immortallity", "Sents the map code", "Andriod only").
 */

export const USERS = [
  {
    user_id: '4572854d-b1b1-406b-82e8-b483998ae0c6',
    name: 'ReareKit',
    username: 'rearekit',
    is_beta: true,
    created_at: '2026-08-24T06:55:30.000000Z',
  },
  {
    user_id: 'a8737f6f-bc1c-486a-b8e7-5deb65fc7e86',
    name: 'Frumtolur',
    username: 'frumtolur',
    is_beta: false,
    created_at: '2026-09-30T21:59:40.000000Z',
  },
];

const REAREKIT = { uuid: '4572854d-b1b1-406b-82e8-b483998ae0c6', name: 'ReareKit' };
const FRUMTOLUR = { uuid: 'a8737f6f-bc1c-486a-b8e7-5deb65fc7e86', name: 'Frumtolur' };

/** Scripts belonging to the second author; everything else is ReareKit's. */
const FRUMTOLUR_SCRIPTS = new Set([
  '01a0f454-bec8-79fc-9136-5b803a880310',
  '01a0f461-d19b-7902-834a-f4a3de66df3d',
  '01a0f46a-4da6-73ce-beb8-65a1f6578f47',
]);

const CATALOGUE = [
  // ---------------------------------------------------------------- ReareKit
  {
    script_id: '01a0328d-96df-7a43-85ea-6d5e04822b0f',
    name: 'Spawn Box On Pin',
    description: null,
    created_at: '2026-08-24T06:55:35.135305Z',
    updated_at: '2026-08-25T18:49:49.249230Z',
    published_at: '2026-08-24T13:01:46.788803Z',
  },
  {
    script_id: '01a032e2-78ee-79a4-b5b2-390bf3924f3f',
    name: 'Tnt on pin',
    description: null,
    created_at: '2026-08-24T08:28:18.030693Z',
    updated_at: '2026-08-24T08:31:21.831645Z',
    published_at: '2026-08-24T09:02:22.065522Z',
  },
  {
    script_id: '01a032e7-0c5e-7406-ab35-d4335eb8f907',
    name: 'tnt when stop movement',
    description: null,
    created_at: '2026-08-24T08:33:17.918456Z',
    updated_at: '2026-08-24T09:59:24.740571Z',
    published_at: '2026-08-24T13:05:02.807373Z',
  },
  {
    script_id: '01a03308-5749-732b-8612-4345a4e94224',
    name: 'TNT every sec',
    description: null,
    created_at: '2026-08-24T09:09:39.785736Z',
    updated_at: '2026-08-31T19:47:36.391554Z',
    published_at: '2026-09-14T08:21:12.231192Z',
  },
  {
    script_id: '01a0332d-6378-721a-9344-3edd037e6e10',
    name: 'Snake',
    description: null,
    created_at: '2026-08-24T09:50:07.736069Z',
    updated_at: '2026-08-24T18:09:20.819959Z',
    published_at: '2026-08-24T15:15:27.225474Z',
  },
  {
    script_id: '01a034f9-bfd1-7927-a57d-ccf705dc570e',
    name: 'snake 2 player',
    description: null,
    created_at: '2026-08-24T18:12:57.937605Z',
    updated_at: '2026-08-24T18:24:06.537438Z',
    published_at: '2026-08-24T18:29:10.472532Z',
  },
  {
    script_id: '01a03512-63ce-7139-9587-5c38ae6f422c',
    name: 'Infinity player snake 3 minutes',
    description: null,
    created_at: '2026-08-24T18:39:52.782174Z',
    updated_at: '2026-08-26T17:47:23.261075Z',
    published_at: '2026-08-26T13:27:55.737088Z',
  },
  {
    script_id: '01a03a41-e0ca-74a3-a493-e2831b986795',
    name: 'Godzilla On Pin',
    description: null,
    created_at: '2026-08-25T18:49:51.050548Z',
    updated_at: '2026-08-29T11:53:52.596466Z',
    published_at: '2026-08-27T14:17:47.014325Z',
  },
  {
    script_id: '01a03fbb-a0ff-7ee1-bd6e-daaa695c6aea',
    name: 'Snake Length Steal 3 minutes',
    description: null,
    created_at: '2026-08-26T20:20:56.191955Z',
    updated_at: '2026-08-26T20:37:04.927489Z',
    published_at: '2026-08-26T20:37:17.295141Z',
  },
  {
    script_id: '01a04d1b-9cfd-7119-a550-18e35c64ec02',
    name: 'Player head snake',
    description: null,
    created_at: '2026-08-29T10:40:50.429161Z',
    updated_at: '2026-08-31T10:10:22.005060Z',
    published_at: '2026-09-03T15:52:45.968686Z',
  },
  {
    script_id: '01a0568b-2989-702a-9667-d2a6600cbd76',
    name: 'Templates',
    description: "Doesn't do anything, just the script I copy and paste in all my new scripts",
    created_at: '2026-08-31T06:39:15.849902Z',
    updated_at: '2026-09-27T09:24:32.656135Z',
    published_at: '2026-09-18T07:42:17.536972Z',
  },
  {
    script_id: '01a0574a-6e5e-7c2c-9481-e3815db511cb',
    name: 'Among Us BETA',
    description: null,
    created_at: '2026-08-31T10:08:10.846206Z',
    updated_at: '2026-09-01T08:32:21.973189Z',
    published_at: '2026-09-01T08:32:29.315595Z',
  },
  {
    script_id: '01a05921-c0d0-7e2a-93d6-a1bf3b4c7c5b',
    name: 'Ghost Primo',
    description: null,
    created_at: '2026-08-31T18:42:59.408217Z',
    updated_at: '2026-08-31T22:23:10.825670Z',
    published_at: '2026-09-01T08:27:16.457136Z',
  },
  {
    script_id: '01a059ee-5855-7998-b955-1c8a8409a567',
    name: 'Ghost Host',
    description: null,
    created_at: '2026-08-31T22:26:27.541541Z',
    updated_at: '2026-09-01T08:27:05.636401Z',
    published_at: '2026-09-01T08:27:46.881801Z',
  },
  {
    script_id: '01a05c14-82fc-78fb-af22-045684a4b48b',
    name: 'Ghost Bolt',
    description: null,
    created_at: '2026-09-01T08:27:23.260799Z',
    updated_at: '2026-09-01T08:27:38.623727Z',
    published_at: '2026-09-01T08:27:42.173434Z',
  },
  {
    script_id: '01a05c38-1697-7b15-a1fc-6f102a7292d7',
    name: 'Among Us BETA 2',
    description: null,
    created_at: '2026-09-01T09:06:14.807377Z',
    updated_at: '2026-09-01T09:13:11.299163Z',
    published_at: '2026-09-01T09:13:25.019785Z',
  },
  {
    script_id: '01a05e54-d206-79b6-951f-1e55e3f5d521',
    name: 'Get Coordinates',
    description: null,
    created_at: '2026-09-01T18:56:52.230021Z',
    updated_at: '2026-09-03T10:07:25.495906Z',
    published_at: '2026-09-03T15:52:36.353424Z',
  },
  {
    script_id: '01a05e5c-e73d-767f-9f19-e370b7f2b0de',
    name: 'Among Us v1.4.5',
    description: null,
    created_at: '2026-09-01T19:05:41.949311Z',
    updated_at: '2026-09-03T15:40:50.858170Z',
    published_at: '2026-09-03T15:52:27.931759Z',
  },
  {
    script_id: '01a06141-9652-75e9-bf81-dc2fb520b22c',
    name: 'Pointer',
    description: null,
    created_at: '2026-09-02T08:34:43.410893Z',
    updated_at: '2026-09-02T09:32:15.432034Z',
    published_at: '2026-09-02T09:37:00.574349Z',
  },
  {
    script_id: '01a06c4c-5697-7e94-a070-849f50779d0b',
    name: 'Among Us v1.5.4',
    description:
      'Play Among Us in null\'s brawl!\n\nRules and map can be found in the "Minigame Manager" mod (in mod library)\n\nDISABLE GADGETS\n\nVariant with 2 imps can be found on my profile',
    created_at: '2026-09-04T12:02:17.367861Z',
    updated_at: '2026-09-28T16:59:17.540811Z',
    published_at: '2026-09-28T16:59:26.335153Z',
    releases: [
      [1860, '2026-09-04T12:02:17.367861Z'],
      [1861, '2026-09-04T12:10:42.356760Z'],
      [1975, '2026-09-04T21:24:22.867208Z'],
      [2055, '2026-09-05T09:51:22.427581Z'],
      [2105, '2026-09-05T14:44:22.710252Z'],
      [2125, '2026-09-05T16:31:56.277732Z'],
      [5516, '2026-09-20T17:55:41.773604Z'],
      [5569, '2026-09-20T18:53:14.905566Z'],
      [6626, '2026-09-22T15:07:38.273816Z'],
      [6633, '2026-09-22T15:21:47.839263Z'],
      [8448, '2026-09-28T16:58:48.581972Z'],
      [8450, '2026-09-28T16:59:17.157191Z'],
    ],
  },
  {
    script_id: '01a06e52-a90b-7608-9962-525b16d75321',
    name: 'Among us v1.5.4 2 impostors',
    description: null,
    created_at: '2026-09-04T21:28:26.123475Z',
    updated_at: '2026-09-28T16:59:05.157237Z',
    published_at: '2026-09-28T16:59:12.850843Z',
  },
  {
    script_id: '01a076bb-1ee9-77a5-ad8c-d354d2b429c1',
    name: 'Reverse Dodgebot Bea',
    description: null,
    created_at: '2026-09-06T12:39:29.769452Z',
    updated_at: '2026-09-06T16:35:03.557856Z',
    published_at: '2026-09-06T18:22:39.421899Z',
  },
  {
    script_id: '01a07794-a496-7e1d-a993-9ed2a1eedb86',
    name: 'Dodgebot',
    description: null,
    created_at: '2026-09-06T16:37:05.302620Z',
    updated_at: '2026-09-08T06:40:11.505876Z',
    published_at: '2026-09-06T18:21:55.528192Z',
  },
  {
    script_id: '01a07d86-5c8f-721b-86d1-4a2d5bd23e79',
    name: 'Vulnerable player tag',
    description:
      '1 player is vulnerable, all others are immune to all damage. When the vulnerable player hits someone, they become the new vulnerable player.\n\nOnly works on non-piercing projectiles!',
    created_at: '2026-09-07T20:19:12.655212Z',
    updated_at: '2026-09-18T07:46:03.836233Z',
    published_at: '2026-09-07T21:46:59.537711Z',
  },
  {
    script_id: '01a07fc2-a75e-7a8b-823f-6c077328708a',
    name: 'Aim and Dodgebot Bea',
    description: null,
    created_at: '2026-09-08T06:44:18.398597Z',
    updated_at: '2026-09-16T19:38:26.284074Z',
    published_at: '2026-09-09T13:24:52.613422Z',
  },
  {
    script_id: '01a08669-2f4e-7f3a-b780-e8c1dfd3a4cc',
    name: 'Aim and Dodgebot All Marksman',
    description: null,
    created_at: '2026-09-09T13:43:55.470292Z',
    updated_at: '2026-09-16T19:34:33.396226Z',
    published_at: '2026-09-14T08:21:59.307774Z',
  },
  {
    script_id: '01a08752-b9f8-7748-b0bc-3e124266ffff',
    name: 'Shields',
    description: 'Spawn walls around the host to block all projectiles from opponents',
    created_at: '2026-09-09T17:59:00.856130Z',
    updated_at: '2026-09-18T07:45:05.317142Z',
    published_at: '2026-09-10T07:19:00.038364Z',
  },
  {
    script_id: '01a0876a-6857-76d1-ad51-8887ed4bcc5f',
    name: 'tp on attack',
    description: null,
    created_at: '2026-09-09T18:24:52.823578Z',
    updated_at: '2026-09-09T18:52:01.089279Z',
    published_at: '2026-09-10T07:18:57.820366Z',
  },
  {
    script_id: '01a08f2c-038b-7680-bbca-e79c5c24d2ee',
    name: 'Random brawlers',
    description: null,
    created_at: '2026-09-11T06:33:41.515298Z',
    updated_at: '2026-09-14T18:13:21.874849Z',
    published_at: '2026-09-11T10:40:58.405703Z',
  },
  {
    script_id: '01a08ffa-cf15-7df9-b5f6-c554867ff0b6',
    name: 'NPC command test',
    description: null,
    created_at: '2026-09-11T10:19:34.037263Z',
    updated_at: '2026-09-11T11:53:47.145921Z',
    published_at: '2026-09-14T10:48:19.820861Z',
  },
  {
    script_id: '01a09051-165c-7ee8-93e3-03b546382bb2',
    name: 'Ghostbusters',
    description:
      'Catch the Shades by touching them!\n\nPlay in knockout map. Map can be loaded from the "Minigame Manager" mod (in mod library)',
    created_at: '2026-09-11T11:53:48.380495Z',
    updated_at: '2026-09-18T07:44:16.441943Z',
    published_at: '2026-09-17T08:24:32.840280Z',
  },
  {
    script_id: '01a091e6-d572-7133-83b1-2846c7180793',
    name: 'Chess',
    description:
      "Play Chess in Null's Brawl!\n\nBoth players play as Ziggy in a knockout map. Map can be loaded from the \"Minigame Manager\" mod (in mod library)",
    created_at: '2026-09-11T19:16:59.378902Z',
    updated_at: '2026-10-27T07:35:52.654559Z',
    published_at: '2026-09-17T19:01:57.253739Z',
  },
  {
    script_id: '01a0a0cf-9d6d-7a5b-898d-e9947cb4dea0',
    name: 'script.lua',
    description: null,
    created_at: '2026-09-14T16:45:55.949616Z',
    updated_at: '2026-09-14T17:13:09.861887Z',
    published_at: '2026-09-14T17:13:13.842893Z',
  },
  {
    script_id: '01a0ae77-c120-7557-b83f-60e5360f7073',
    name: 'Random Projectile Directions',
    description: 'All projectiles move in random directions',
    created_at: '2026-09-17T08:24:38.944782Z',
    updated_at: '2026-09-18T07:43:05.642406Z',
    published_at: '2026-09-17T09:07:12.091985Z',
  },
  {
    script_id: '01a0aea3-0995-7c7d-9555-c8c777fd81f3',
    name: 'Ball Pull',
    description: null,
    created_at: '2026-09-17T09:11:55.541761Z',
    updated_at: '2026-09-17T19:01:47.123869Z',
    published_at: '2026-09-17T19:01:50.682058Z',
  },
  {
    script_id: '01a0b5e8-5c3c-7675-ab33-15b56d39b729',
    name: 'Pong BETA',
    description:
      'Still work in progress minigame. Rules should be clear, if you have the map (included with Minigame Manager v1.1.0)',
    created_at: '2026-09-18T19:04:59.196903Z',
    updated_at: '2026-09-20T19:07:22.486599Z',
    published_at: '2026-09-20T19:06:15.766805Z',
  },
  {
    script_id: '01a0b912-9b82-728a-9b6f-71da859af7f0',
    name: 'Ziggy trap',
    description:
      'Use Ziggy in my "Doors" map and trap the other player. Normal damage is disabled, you get killed when you get trapped.',
    created_at: '2026-09-19T09:49:59.554840Z',
    updated_at: '2026-09-19T18:31:10.542946Z',
    published_at: '2026-09-19T19:01:35.235928Z',
  },
  {
    script_id: '01a0bb30-a1be-79f8-b2fa-7db6e94fe19b',
    name: 'Dots and Boxes',
    description:
      'Use Ziggy in my "Doors" map.\n\nWhen you have hypercharge partial charged, it\'s your turn. When your time runs out, your turn is skipped. When your turn is skipped 3 times in a row, all your future turns are skipped too.\nUse main to build a wall.\n\nRules:\nBuild 1 wall every turn. When you build the 4th wall of a box, you get a point and it\'s your turn again.\n\nGame ends when the last wall is build.',
    created_at: '2026-09-19T19:42:01.662997Z',
    updated_at: '2026-09-20T19:06:06.778769Z',
    published_at: '2026-09-20T15:32:05.831813Z',
  },
  {
    script_id: '01a0beb8-db51-7b35-a86c-a743e3d2cd45',
    name: 'Immortallity',
    description: 'All damage the host takes is healed instant.',
    created_at: '2026-09-20T12:09:40.945519Z',
    updated_at: '2026-09-20T12:45:07.411957Z',
    published_at: '2026-09-20T12:45:10.785042Z',
  },
  {
    script_id: '01a0c383-d6ec-7ea2-8a46-289e1ca776e3',
    name: 'Najia Golf',
    description:
      'Hardest minigame ever!\n\nUse Najia, you can change the direction of the pot. Release to teleport. You cannot teleport on water. Map is in minigame manager v1.2.0',
    created_at: '2026-09-21T10:29:52.492928Z',
    updated_at: '2026-09-30T08:31:20.598433Z',
    published_at: '2026-09-28T08:06:34.609214Z',
  },
  {
    script_id: '01a0c4b2-d73a-707f-8163-18a929331ab1',
    name: 'Random Trait',
    description: 'Gives everyone a random trait every 3 seconds. CRASH RISK',
    created_at: '2026-09-21T16:00:49.978625Z',
    updated_at: '2026-10-03T10:12:11.193240Z',
    published_at: '2026-10-03T10:15:34.045661Z',
  },
  {
    script_id: '01a0c7d7-7546-7469-bb16-5e11fd024d61',
    name: 'WASABI',
    description: 'Enables all wasabi powers, included the duels glitch.',
    created_at: '2026-09-22T06:39:41.382426Z',
    updated_at: '2026-09-22T12:40:07.054813Z',
    published_at: '2026-09-22T12:53:16.924298Z',
  },
  {
    script_id: '01a0c926-da62-7da6-8771-a94c0731375c',
    name: 'NANOPOWERS 2',
    description: 'Enables all second nanopowers of all brawlers with nanopowers.',
    created_at: '2026-09-22T12:46:01.826684Z',
    updated_at: '2026-09-23T07:20:28.266266Z',
    published_at: '2026-09-23T07:20:36.153272Z',
  },
  {
    script_id: '01a0c926-f25e-795f-8d3c-f18484329eaf',
    name: 'NANOPOWERS 3',
    description: 'Enables all third nanopowers of all brawlers with nanopowers.',
    created_at: '2026-09-22T12:46:07.966908Z',
    updated_at: '2026-09-23T06:48:13.493997Z',
    published_at: '2026-09-23T06:48:17.587008Z',
  },
  {
    script_id: '01a0c927-ad39-7010-be3d-cc13cadf2bc8',
    name: 'ALL nanopowers',
    description: 'Enables all 3 nanopowers of all brawlers with nanopowers',
    created_at: '2026-09-22T12:46:55.801541Z',
    updated_at: '2026-09-23T06:47:41.782725Z',
    published_at: '2026-09-23T06:47:52.809231Z',
  },
  {
    script_id: '01a0cd24-9840-70bf-b5b7-96a44713b772',
    name: 'Among Us v1.5.5',
    description:
      'Play Among Us in null\'s brawl!\n\nRules and map can be found in the "Minigame Manager" mod (in mod library)\n\nEnable the parameter "Disable Poison" if you want to play with Russian language\n\nThis is the last version that supports iOS. All newer versions include UI elements.',
    created_at: '2026-09-23T07:22:02.688237Z',
    updated_at: '2026-10-26T19:50:37.842261Z',
    published_at: '2026-10-21T09:19:54.376992Z',
  },
  {
    script_id: '01a0ddc2-3524-7eff-b0de-47836967ffd5',
    name: 'New Script 107',
    description: null,
    created_at: '2026-09-26T12:48:07.460613Z',
    updated_at: '2026-10-08T14:32:20.541455Z',
    published_at: '2026-10-08T12:55:10.664399Z',
  },
  {
    script_id: '01a0e22a-69d0-760c-aa81-ad0335ac47c9',
    name: 'Candy Dodge v1.1.0',
    description:
      "NPC Mandy's will fire super in straight lines. Every 5 rounds, 2 more Mandy's appear. Survive as long as possible\n\nDISABLE GADGET, STARPOWER AND HYPERCHARGE.\n\nBOLT, MEG AND WENDY BANNED",
    created_at: '2026-09-27T09:20:25.552693Z',
    updated_at: '2026-09-30T18:48:52.865783Z',
    published_at: '2026-09-30T18:49:01.704032Z',
  },
  {
    script_id: '01a0f141-7ad1-7bc0-a3f5-b4b75d69b7d5',
    name: 'Blindness',
    description:
      'Nobody can see any other player, projectile or item (except for things like the ball in brawl ball)',
    created_at: '2026-09-30T07:39:55.473738Z',
    updated_at: '2026-10-04T10:26:14.339753Z',
    published_at: '2026-09-30T07:47:29.290547Z',
  },
  {
    script_id: '01a0fc42-db49-787e-b012-e612d79238c6',
    name: 'ALL wasabi',
    description:
      "Every brawler gains almost every wasabi power (Except for Leon (Leon's wasabi sets super range to 0), Charlie (charlie's spiders cause too much chaos) and Eve (bugged, also applies on pets, causing pets to spawn more pets when they lose hp))\n\nPowers are applied over time, 10 traits each tick.",
    created_at: '2026-10-02T10:57:15.081170Z',
    updated_at: '2026-10-04T10:10:13.158226Z',
    published_at: '2026-10-02T15:43:37.058190Z',
  },
  {
    script_id: '01a0fd3f-b3a5-7491-8c1f-a6f6fa850cc6',
    name: 'New Script 116',
    description: null,
    created_at: '2026-10-02T15:33:25.541668Z',
    updated_at: '2026-10-02T15:42:58.866590Z',
    published_at: '2026-10-02T15:33:32.866298Z',
  },
  {
    script_id: '01a1111a-b363-7165-b9d8-c516f6a67e82',
    name: 'New balance changes',
    description: 'Adds balance changes to every brawler 51/108 done',
    created_at: '2026-10-06T12:05:24.963030Z',
    updated_at: '2026-10-22T22:10:52.247499Z',
    published_at: '2026-10-22T22:11:04.543549Z',
  },
  {
    script_id: '01a11a7a-e3ad-745f-9884-ca6faf40e2ad',
    name: 'Random brawler change every 5',
    description:
      'Your brawler changes into another every 5 seconds. Gadgets, starpower, gear and skin remain the same',
    created_at: '2026-10-08T07:47:03.725225Z',
    updated_at: '2026-10-08T08:10:37.911304Z',
    published_at: '2026-10-08T08:10:41.805252Z',
  },
  {
    script_id: '01a11fb7-c999-70a6-b7b9-12c4f345e27c',
    name: 'Gadget Starpower swap',
    description:
      'In duels, you use all rounds your first brawler. However, in the second and third round, you use the build of your second and third brawler',
    created_at: '2026-10-09T08:11:40.825512Z',
    updated_at: '2026-10-09T09:25:44.879490Z',
    published_at: '2026-10-09T09:25:49.853454Z',
  },
  {
    script_id: '01a135c9-dbf0-7549-b715-27910decb9dc',
    name: 'Map Reader',
    description: 'Sents the map code in the chat. You can convert a map code to map code',
    created_at: '2026-10-13T15:03:03.920667Z',
    updated_at: '2026-10-21T12:51:50.023204Z',
    published_at: '2026-10-15T09:06:43.420518Z',
  },
  {
    script_id: '01a15878-cf07-7450-afb6-be21089f6ad1',
    name: 'BFEK',
    description: null,
    created_at: '2026-10-20T08:41:14.759826Z',
    updated_at: '2026-10-20T08:51:32.755536Z',
    published_at: '2026-10-20T08:51:35.717094Z',
  },
  {
    script_id: '01a163c6-2baf-7d99-8308-ffc61ac75585',
    name: 'Infinity range and home',
    description: 'All projectiles home, have infinity range, bounce and break walls',
    created_at: '2026-10-22T13:21:34.127092Z',
    updated_at: '2026-10-23T22:26:28.399170Z',
    published_at: '2026-10-22T14:32:20.866966Z',
  },
  {
    script_id: '01a167b5-9137-731d-92df-393db5c5063b',
    name: 'Among us v2.1.0',
    description:
      'Play Among Us in null\'s brawl!\n\nRules and map can be found in the "Minigame Manager" mod (in mod library)\n\nEnable the parameter "Disable Poison" if you want to play with Russian language\n\nThis version doesn\'t work iOS yet. If you want to play with someone on iOS, select v1.5.5',
    created_at: '2026-10-23T07:41:54.871837Z',
    updated_at: '2026-10-26T19:14:52.362834Z',
    published_at: '2026-10-26T19:10:41.292871Z',
  },
  {
    script_id: '01a168c6-6268-7157-9712-c1ecaf2a5566',
    name: 'Cheats Menu',
    description: 'Gives the host a cheats menu (Andriod only)',
    created_at: '2026-10-23T12:39:54.216976Z',
    updated_at: '2026-10-25T12:25:41.427702Z',
    published_at: '2026-10-23T22:16:26.829524Z',
  },
  {
    script_id: '01a172bf-1fbd-7488-a115-2532562f04b3',
    name: 'Shop',
    description:
      'Coins spawn randomly around the map. Collect them to buy buffs.\n\nYou drop 50% of your coins on death',
    created_at: '2026-10-25T11:08:10.557992Z',
    updated_at: '2026-10-25T17:00:56.947115Z',
    published_at: '2026-10-25T17:01:00.069607Z',
  },
  {
    script_id: '01a17c53-1125-77fb-b0f8-a77718b89bc1',
    name: 'Among Us 3.0.1 beta',
    description:
      '3.0.0\n       \nAdded Roles and tasks.\n\n3.0.1:\n- Reworked role selection\n\nVInce, Bolt and Finx banned',
    user_map_id: '81a438bb-58dc-4ddd-9cc1-4385fbe92843',
    user_map_internal_id: 'CGRPCGUCL:89020UC2PRJ',
    created_at: '2026-10-27T07:46:21.093854Z',
    updated_at: '2026-10-28T17:58:44.116915Z',
    published_at: '2026-10-30T07:51:05.560519Z',
  },
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

  // --------------------------------------------------------------- Frumtolur
  {
    script_id: '01a0f454-bec8-79fc-9136-5b803a880310',
    name: 'Проверка координат',
    description:
      'Три снимка состояния собственной дружеской игры. Только чтение координат, здоровья и признака бота; поведение боя не изменяется.',
    created_at: '2026-09-30T21:59:49.704365Z',
    updated_at: '2026-09-30T22:01:07.587269Z',
    published_at: '2026-09-30T22:04:18.921274Z',
  },
  {
    script_id: '01a0f461-d19b-7902-834a-f4a3de66df3d',
    name: 'LabProbe',
    description: null,
    created_at: '2026-09-30T22:14:06.491793Z',
    updated_at: '2026-09-30T22:14:36.465213Z',
    published_at: '2026-09-30T22:15:37.285451Z',
  },
  {
    script_id: '01a0f46a-4da6-73ce-beb8-65a1f6578f47',
    name: 'LabProbe.lua',
    description: null,
    created_at: '2026-09-30T22:23:22.534379Z',
    updated_at: '2026-09-30T22:23:22.534379Z',
    published_at: '2026-09-30T22:25:39.621762Z',
  },
];

export const SCRIPTS = CATALOGUE.map((script) => {
  const author = FRUMTOLUR_SCRIPTS.has(script.script_id) ? FRUMTOLUR : REAREKIT;
  return { ...script, author_uuid: author.uuid, author_name: author.name };
});

/**
 * Known (timestamp -> release id) pairs taken from the two release lists that
 * were captured in full. Everything else is interpolated between these, which
 * keeps the counter monotonic in time — the one property the live data shows.
 */
export const RELEASE_ID_ANCHORS = [
  ['2026-08-24T06:55:35.135305Z', 200],
  ['2026-09-04T12:02:17.367861Z', 1860],
  ['2026-09-28T16:59:17.157191Z', 8450],
  ['2026-10-28T15:00:41.895585Z', 15862],
  ['2026-10-29T15:33:17.189466Z', 16126],
];
