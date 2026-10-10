import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const DB_PATH = process.env.COMMUNITY_LINK_DB ?? join(process.cwd(), ".data", "community-link.db");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  handle        TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  avatar_hue    INTEGER NOT NULL DEFAULT 210,
  bio           TEXT NOT NULL DEFAULT '',
  skills        TEXT NOT NULL DEFAULT '[]',
  trust_score   INTEGER NOT NULL DEFAULT 50,
  share_precise_location INTEGER NOT NULL DEFAULT 0,
  discoverable  INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- A zone is a temporary, place-bound community. When it ends, everything in it is purged.
CREATE TABLE IF NOT EXISTS zones (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,            -- campus | hackathon | event | transit | techpark | neighbourhood
  description TEXT NOT NULL DEFAULT '',
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  radius_m    INTEGER NOT NULL DEFAULT 500,
  join_code   TEXT NOT NULL UNIQUE,
  starts_at   INTEGER NOT NULL,
  ends_at     INTEGER NOT NULL,
  purge_at    INTEGER NOT NULL,         -- hard-delete all zone content at this instant
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  archived_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_zones_ends ON zones(ends_at);

CREATE TABLE IF NOT EXISTS memberships (
  id          TEXT PRIMARY KEY,
  zone_id     TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',   -- member | organizer | moderator
  joined_at   INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  left_at     INTEGER,
  is_banned   INTEGER NOT NULL DEFAULT 0,
  muted_until INTEGER,
  UNIQUE (zone_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_zone ON memberships(zone_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

-- Template-driven, self-destructing posts. The heart of the product.
CREATE TABLE IF NOT EXISTS posts (
  id            TEXT PRIMARY KEY,
  zone_id       TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  author_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template      TEXT NOT NULL,          -- lost_found | found_item | requirement | promotion | announcement | question
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  payload       TEXT NOT NULL DEFAULT '{}',  -- template-specific fields (JSON)
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,       -- the "timeline" every post must carry
  resolve_mode  TEXT NOT NULL,          -- claim_confirm | fill_slots | quota | deadline | manual
  slots_needed  INTEGER NOT NULL DEFAULT 1,
  slots_filled  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'open',  -- open | resolved | expired | removed
  resolved_at   INTEGER,
  resolved_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolution_note TEXT,
  purge_at      INTEGER,                -- tombstone hard-delete instant (set on resolve/expire)
  is_anonymous  INTEGER NOT NULL DEFAULT 0,
  urgency       TEXT NOT NULL DEFAULT 'normal', -- normal | high | critical
  view_count    INTEGER NOT NULL DEFAULT 0,
  pinned        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_posts_zone_status ON posts(zone_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_expiry ON posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_purge ON posts(purge_at);

-- Offers / claims / answers against a post. Accepting these is what "resolves" a post.
CREATE TABLE IF NOT EXISTS responses (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,            -- claim | offer | answer | ack
  body       TEXT NOT NULL DEFAULT '',
  meta       TEXT NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | withdrawn
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_responses_post ON responses(post_id);

-- 1-to-many: public zone channels.
CREATE TABLE IF NOT EXISTS channels (
  id          TEXT PRIMARY KEY,
  zone_id     TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT 'public',  -- public | announce (organizers post, everyone reads)
  created_at  INTEGER NOT NULL,
  UNIQUE (zone_id, slug)
);

CREATE TABLE IF NOT EXISTS channel_messages (
  id         TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,                 -- channel chatter is ephemeral too
  deleted_at INTEGER,
  deleted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  post_id    TEXT REFERENCES posts(id) ON DELETE SET NULL  -- system cross-posts
);
CREATE INDEX IF NOT EXISTS idx_chanmsg_channel ON channel_messages(channel_id, created_at);

-- 1-to-1: private threads. Used to reach an organizer without going public.
CREATE TABLE IF NOT EXISTS dm_threads (
  id         TEXT PRIMARY KEY,
  zone_id    TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  user_lo    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- lexicographically smaller id
  user_hi    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic      TEXT NOT NULL DEFAULT '',
  post_id    TEXT REFERENCES posts(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  closed_at  INTEGER,
  close_reason TEXT,
  UNIQUE (zone_id, user_lo, user_hi, post_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_zone ON dm_threads(zone_id);

CREATE TABLE IF NOT EXISTS dm_messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at    INTEGER,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_dmmsg_thread ON dm_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  zone_id     TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,          -- post | channel_message | dm_message | user
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',  -- open | actioned | dismissed
  created_at  INTEGER NOT NULL,
  handled_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  handled_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_reports_zone ON reports(zone_id, status);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS mod_actions (
  id          TEXT PRIMARY KEY,
  zone_id     TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_modactions_zone ON mod_actions(zone_id, created_at);

-- Append-only lifecycle trail: proves *why* something vanished.
CREATE TABLE IF NOT EXISTS lifecycle_events (
  id         TEXT PRIMARY KEY,
  zone_id    TEXT NOT NULL,
  subject_type TEXT NOT NULL,         -- post | thread | message | zone
  subject_id TEXT NOT NULL,
  type       TEXT NOT NULL,           -- created | responded | accepted | resolved | expired | purged | removed
  actor_id   TEXT,
  detail     TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_subject ON lifecycle_events(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_zone ON lifecycle_events(zone_id, created_at);

CREATE TABLE IF NOT EXISTS rate_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  bucket     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate ON rate_events(user_id, bucket, created_at);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

declare global {
  // eslint-disable-next-line no-var
  var __communityLinkDb: Database.Database | undefined;
}

function create(): Database.Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}

/** Process-wide SQLite handle (survives Next.js dev hot-reloads). */
export function getDb(): Database.Database {
  const existing = globalThis.__communityLinkDb;
  if (existing) {
    // `npm run reset` unlinks the file while we hold it open. POSIX keeps the
    // inode alive, so writes would silently vanish into a deleted file. Notice
    // that and start a fresh database instead.
    if (existsSync(DB_PATH)) return existing;
    try {
      existing.close();
    } catch {
      /* already gone */
    }
    globalThis.__communityLinkDb = undefined;
  }
  globalThis.__communityLinkDb = create();
  return globalThis.__communityLinkDb;
}

export function nowMs(): number {
  return Date.now();
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}
