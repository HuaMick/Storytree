-- storytree runtime store DDL (ADR-0017): JSONB docs, history = append-only events,
-- current = projection. Relationships are id pointers held INSIDE the docs (no cross-table keys).
-- Idempotent: safe to run repeatedly (applied by migrate.ts / loadCorpus).

CREATE SCHEMA IF NOT EXISTS events;

-- Library history: one append-only event per write (created/updated/deleted).
CREATE TABLE IF NOT EXISTS events.library_event (
  seq   BIGSERIAL PRIMARY KEY,
  id    TEXT NOT NULL,
  kind  TEXT NOT NULL,
  type  TEXT NOT NULL CHECK (type IN ('created', 'updated', 'deleted')),
  doc   JSONB,
  actor TEXT NOT NULL,
  at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Library current-state projection: one row per live artifact id.
CREATE TABLE IF NOT EXISTS events.library_artifact (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  doc        JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment history: append-only.
CREATE TABLE IF NOT EXISTS events.comment_event (
  seq   BIGSERIAL PRIMARY KEY,
  id    TEXT NOT NULL,
  type  TEXT NOT NULL,
  doc   JSONB,
  actor TEXT NOT NULL,
  at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment current-state projection.
CREATE TABLE IF NOT EXISTS events.comment (
  id         TEXT PRIMARY KEY,
  doc        JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes (ADR-0017).
CREATE INDEX IF NOT EXISTS library_artifact_kind_idx ON events.library_artifact (kind);
CREATE INDEX IF NOT EXISTS library_event_id_idx ON events.library_event (id);
