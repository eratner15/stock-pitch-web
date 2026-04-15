-- Migration 003: portal generation jobs
-- Async job state for /stock-pitch/generate → 5-page portal pipeline
-- Apply: wrangler d1 execute stock-pitch-db --remote --file=src/db/migrations/003_portal_jobs.sql

CREATE TABLE IF NOT EXISTS portal_jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT,                             -- nullable until auth gates in
  ticker TEXT NOT NULL,
  company TEXT,
  direction TEXT,                           -- long | short | null
  thesis TEXT,                              -- raw user thesis, if provided
  price_target REAL,
  status TEXT NOT NULL DEFAULT 'queued',    -- queued | researching | writing | complete | failed
  step TEXT,                                -- current step description for progress UI
  pages_complete INTEGER DEFAULT 0,         -- 0..5
  pages_total INTEGER DEFAULT 5,
  error_message TEXT,
  entry_price REAL,                         -- locked at job creation
  entry_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_portal_jobs_ticker ON portal_jobs(ticker);
CREATE INDEX IF NOT EXISTS idx_portal_jobs_user ON portal_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_jobs_status ON portal_jobs(status);
