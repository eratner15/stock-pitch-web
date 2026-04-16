-- Migration 004: portals catalog + feedback loop + books
-- The infinite research desk: every generated portal tracked with confidence index,
-- auto-constructed long/short books sized by conviction.
-- Apply: wrangler d1 execute stock-pitch-db --remote --file=src/db/migrations/004_portals_and_feedback.sql

CREATE TABLE IF NOT EXISTS portals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  ticker TEXT NOT NULL,
  company TEXT,
  sector TEXT,                              -- REIT, BANK, SAAS, etc.
  direction TEXT,                           -- long | short (AI-determined)
  rating TEXT,                              -- BUY, OVERWEIGHT, SELL, etc.
  price_at_generation REAL,
  price_target REAL,
  upside_pct REAL,                          -- (PT - price) / price
  critic_score INTEGER DEFAULT 0,           -- 0-100 from Karpathy critic
  verification_rate REAL DEFAULT 0,         -- 0-1 from fact verifier
  confidence_index REAL DEFAULT 0,          -- composite 0-100
  total_words INTEGER DEFAULT 0,
  total_claims INTEGER DEFAULT 0,
  verified_claims INTEGER DEFAULT 0,
  summary TEXT,                             -- 1-2 sentence AI-generated BLUF
  job_id TEXT,
  generated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(ticker)                            -- latest generation wins
);

CREATE INDEX IF NOT EXISTS idx_portals_confidence ON portals(confidence_index DESC);
CREATE INDEX IF NOT EXISTS idx_portals_direction ON portals(direction);
CREATE INDEX IF NOT EXISTS idx_portals_sector ON portals(sector);

CREATE TABLE IF NOT EXISTS portal_feedback (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  portal_id TEXT NOT NULL REFERENCES portals(id),
  section TEXT NOT NULL,                    -- 'executive_summary', 'valuation', etc.
  rating INTEGER NOT NULL,                  -- 1 (bad) to 5 (great)
  comment TEXT,                             -- optional freetext
  ip TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_portal ON portal_feedback(portal_id);

-- Books view: long and short portfolios auto-constructed from confidence
CREATE TABLE IF NOT EXISTS book_positions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  book TEXT NOT NULL,                       -- 'long' | 'short'
  ticker TEXT NOT NULL,
  confidence_index REAL NOT NULL,
  weight_pct REAL NOT NULL,                 -- position size (confidence / sum)
  price_at_entry REAL,
  price_target REAL,
  added_at TEXT DEFAULT (datetime('now')),
  UNIQUE(book, ticker)
);

CREATE INDEX IF NOT EXISTS idx_book_positions_book ON book_positions(book);
