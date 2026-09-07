-- BeatinDaBlock D1 Database Schema
-- Run with: wrangler d1 execute beatindablock-episodes --file=cloudflare/db/schema.sql

-- ── Episodes ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS episodes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL,
  slug         TEXT    UNIQUE NOT NULL,
  pub_date     TEXT,                        -- ISO 8601: 2013-06-15
  description  TEXT,
  audio_url    TEXT,
  duration     TEXT,                        -- HH:MM:SS
  guest        TEXT,
  era          TEXT    CHECK(era IN ('archive', 'new')) DEFAULT 'new',
  wp_post_id   INTEGER,                     -- optional: links back to WordPress post
  created_at   TEXT    DEFAULT (datetime('now')),
  updated_at   TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_episodes_pub_date ON episodes(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_era      ON episodes(era);
CREATE INDEX IF NOT EXISTS idx_episodes_slug     ON episodes(slug);

-- ── Full-text search virtual table ───────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts
  USING fts5(title, description, guest, content='episodes', content_rowid='id');

-- Keep FTS in sync
CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
  INSERT INTO episodes_fts(rowid, title, description, guest)
  VALUES (new.id, new.title, new.description, new.guest);
END;

CREATE TRIGGER IF NOT EXISTS episodes_ad AFTER DELETE ON episodes BEGIN
  INSERT INTO episodes_fts(episodes_fts, rowid, title, description, guest)
  VALUES ('delete', old.id, old.title, old.description, old.guest);
END;

CREATE TRIGGER IF NOT EXISTS episodes_au AFTER UPDATE ON episodes BEGIN
  INSERT INTO episodes_fts(episodes_fts, rowid, title, description, guest)
  VALUES ('delete', old.id, old.title, old.description, old.guest);
  INSERT INTO episodes_fts(rowid, title, description, guest)
  VALUES (new.id, new.title, new.description, new.guest);
END;

-- ── Guests ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT UNIQUE NOT NULL,
  bio     TEXT,
  twitter TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Seed: Archive Episodes (fill in from Wayback Machine scrape) ──────────────
-- INSERT INTO episodes (title, slug, pub_date, era) VALUES
--   ('Episode 1 — Title TBD', 'ep-01', '2012-01-01', 'archive'),
--   ('Episode 2 — Title TBD', 'ep-02', '2012-02-01', 'archive');

-- ── AT Protocol Feed Generator ──────────────────────────────────────────────
-- Curated list of Bluesky accounts whose posts appear in the custom feed.
-- Add more later with:
--   wrangler d1 execute beatindablock-episodes --command="INSERT OR IGNORE INTO feed_accounts (handle) VALUES ('somehandle.bsky.social')"
CREATE TABLE IF NOT EXISTS feed_accounts (
  handle    TEXT PRIMARY KEY,           -- e.g. 'oneseco.com'
  did       TEXT,                       -- resolved lazily by the atproto-feed Worker
  added_at  TEXT DEFAULT (datetime('now'))
);

-- Posts indexed from the curated accounts' feeds, served via getFeedSkeleton.
CREATE TABLE IF NOT EXISTS feed_posts (
  uri         TEXT PRIMARY KEY,         -- at://did/app.bsky.feed.post/rkey
  cid         TEXT NOT NULL,
  author_did  TEXT NOT NULL,
  created_at  TEXT NOT NULL,            -- post's own createdAt (ISO 8601)
  indexed_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_indexed ON feed_posts(indexed_at DESC, uri DESC);

INSERT OR IGNORE INTO feed_accounts (handle) VALUES ('oneseco.com');
