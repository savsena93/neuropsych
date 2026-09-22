-- schema.sql
-- -----------------------------------------------------------------------
-- D1 (SQLite) schema for the Cloudflare Worker backend (worker.js).
-- Apply once when setting up the deployment, and again whenever it
-- changes:
--   npx wrangler d1 execute DB --file=schema.sql --remote   (production)
--   npx wrangler d1 execute DB --file=schema.sql --local    (development)
--
-- The tables mirror the localStorage schema in js/storage.js one-to-one.
-- Columns are snake_case; worker.js maps every row back to the exact
-- camelCase shapes the client expects. Nested data (consent, the selected
-- tests, responses, scores, pauses) is stored as JSON TEXT columns, which
-- keeps the schema simple while matching the client's data model.
-- The settings table also holds the auto-generated token signing secret
-- (key 'auth_secret') when no AUTH_SECRET variable is configured — that
-- row is deliberately never exposed through the API or the export.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  role            TEXT NOT NULL,
  name            TEXT NOT NULL,
  pin             TEXT NOT NULL,
  must_change_pin INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  code          TEXT PRIMARY KEY,
  participant_pin TEXT,
  assigned_tests TEXT NOT NULL DEFAULT '[]',
  age           TEXT,
  sex           TEXT,
  education     TEXT,
  referral      TEXT,
  date_enrolled TEXT NOT NULL,
  consent       TEXT NOT NULL,
  created_by    TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id               TEXT PRIMARY KEY,
  participant_code TEXT NOT NULL,
  examiner_id      TEXT,
  tests_selected   TEXT NOT NULL DEFAULT '[]',
  status           TEXT NOT NULL DEFAULT 'in_progress',
  practice_mode    INTEGER NOT NULL DEFAULT 0,
  started_at       TEXT NOT NULL,
  completed_at     TEXT,
  responses        TEXT NOT NULL DEFAULT '{}',
  scores           TEXT NOT NULL DEFAULT '{}',
  pauses           TEXT NOT NULL DEFAULT '[]',
  deleted          INTEGER NOT NULL DEFAULT 0,
  delete_reason    TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  timestamp   TEXT NOT NULL,
  actor_id    TEXT,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  reason      TEXT,
  details     TEXT
);

-- Latest live drawing snapshot per session, for the examiner's real-time
-- view (SRS). Only ever holds the most recent snapshot per session; the
-- finished drawings live in sessions.responses JSON like everything else.
CREATE TABLE IF NOT EXISTS live_state (
  session_id TEXT PRIMARY KEY,
  test_key  TEXT,
  item_id   TEXT,
  image_url TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_examiner    ON sessions(examiner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_participant ON sessions(participant_code);
CREATE INDEX IF NOT EXISTS idx_participants_creator ON participants(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp      ON audit_log(timestamp);
