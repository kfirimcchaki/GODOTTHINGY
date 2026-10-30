import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';

/**
 * Tiny document store persisted to a single JSON file.
 *
 * The upstream service is backed by a relational database (releases carry
 * dense integer primary keys such as 15862, 15887, 16126). We keep the same
 * externally visible shape while staying dependency-free.
 */
const EMPTY = {
  users: [],
  scripts: [],
  releases: [],
  favorites: [],
  sessions: [],
  shareLinks: [],
  counters: { release: 1 },
  seeded: false,
};

const file = path.join(config.dataDir, 'db.json');

let state = structuredClone(EMPTY);
let writeTimer = null;

function load() {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    state = { ...structuredClone(EMPTY), ...JSON.parse(raw) };
  } catch {
    state = structuredClone(EMPTY);
  }
}

function flush() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file);
}

/** Debounced write so request handlers can mutate freely. */
export function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      flush();
    } catch (err) {
      console.error('[db] failed to persist:', err.message);
    }
  }, 25);
}

export function save() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  flush();
}

load();

export const db = {
  get users() {
    return state.users;
  },
  get scripts() {
    return state.scripts;
  },
  get releases() {
    return state.releases;
  },
  get favorites() {
    return state.favorites;
  },
  get sessions() {
    return state.sessions;
  },
  get shareLinks() {
    return state.shareLinks;
  },

  nextReleaseId() {
    const id = state.counters.release;
    state.counters.release += 1;
    persist();
    return id;
  },

  setReleaseCounter(value) {
    state.counters.release = Math.max(state.counters.release, value);
    persist();
  },

  get isSeeded() {
    return state.seeded;
  },
  markSeeded() {
    state.seeded = true;
    save();
  },

  reset() {
    state = structuredClone(EMPTY);
    save();
  },
};

export default db;
