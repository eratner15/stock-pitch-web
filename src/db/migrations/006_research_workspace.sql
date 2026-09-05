-- Additive only. Membership is intentionally empty: no public sign-up grants team access.
CREATE TABLE research_members (user_id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('analyst','reviewer')), granted_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE research_etf_snapshots (id TEXT PRIMARY KEY, etf TEXT NOT NULL, as_of TEXT, retrieved_at TEXT NOT NULL, source_url TEXT NOT NULL, provider TEXT NOT NULL, completeness TEXT NOT NULL, data_json TEXT NOT NULL, created_by TEXT NOT NULL);
CREATE INDEX research_etf_lookup ON research_etf_snapshots(etf, retrieved_at DESC);
CREATE TABLE research_revisions (
  id TEXT PRIMARY KEY, document_id TEXT NOT NULL, company_id TEXT NOT NULL, ticker TEXT NOT NULL,
  previous_id TEXT REFERENCES research_revisions(id), snapshot_id TEXT REFERENCES research_etf_snapshots(id),
  title TEXT NOT NULL, source_json TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','generating','failed','review','approved','published','withdrawn')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
  version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at TEXT NOT NULL,
  revised_at TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT, published_at TEXT,
  run_id TEXT, generation_started_at TEXT, error_code TEXT,
  idempotency_key TEXT NOT NULL, UNIQUE(created_by, idempotency_key)
);
CREATE INDEX research_revision_company ON research_revisions(company_id, revised_at DESC);
CREATE TABLE research_publication_events (id TEXT PRIMARY KEY, revision_id TEXT NOT NULL, actor_id TEXT NOT NULL, event TEXT NOT NULL, occurred_at TEXT NOT NULL);
