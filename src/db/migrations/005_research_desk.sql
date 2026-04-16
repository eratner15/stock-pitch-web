-- Migration 005: Research Desk — workflow runs, outputs, LB position cache
-- The Research Desk expands stock-pitch from pitch builder to full research platform.
-- Each workflow run (screen, dcf, comps, etc.) is tracked with structured outputs.
-- Apply: wrangler d1 execute stock-pitch-db --remote --file=src/db/migrations/005_research_desk.sql

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  workflow TEXT NOT NULL,              -- 'screen','dcf','comps','earnings','coverage','conference','sector','portfolio','morning','thesis'
  ticker TEXT,                         -- null for portfolio-wide workflows (morning, portfolio)
  status TEXT DEFAULT 'running' CHECK(status IN ('running','streaming','complete','failed')),
  input_params TEXT,                   -- JSON: workflow-specific input (ticker, context, etc.)
  output_summary TEXT,                 -- 1-2 sentence BLUF for listing
  output_json TEXT,                    -- full structured output
  output_html TEXT,                    -- rendered HTML (cached for display)
  tool_calls INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wr_user ON workflow_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wr_ticker ON workflow_runs(ticker, workflow);
CREATE INDEX IF NOT EXISTS idx_wr_status ON workflow_runs(status);

CREATE TABLE IF NOT EXISTS workflow_outputs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  output_type TEXT NOT NULL,           -- 'dcf_model','comps_table','screen_results','thesis','earnings_note','sector_map'
  ticker TEXT,
  data_json TEXT NOT NULL,             -- structured output for cross-workflow linking
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wo_run ON workflow_outputs(run_id);
CREATE INDEX IF NOT EXISTS idx_wo_ticker ON workflow_outputs(ticker, output_type);

-- LB position cache — synced via cron, read by portfolio/morning workflows
CREATE TABLE IF NOT EXISTS lb_positions_cache (
  ticker TEXT NOT NULL,
  axys_code TEXT NOT NULL,
  account_name TEXT,
  side TEXT,                           -- 'LONG','SHORT'
  shares REAL DEFAULT 0,
  last_price REAL DEFAULT 0,
  market_value REAL DEFAULT 0,
  cost_basis REAL DEFAULT 0,
  pnl_day REAL DEFAULT 0,
  pnl_mtd REAL DEFAULT 0,
  pnl_ytd REAL DEFAULT 0,
  weight_pct REAL DEFAULT 0,
  asset_class TEXT DEFAULT 'EQUITY',
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (ticker, axys_code)
);

CREATE INDEX IF NOT EXISTS idx_lb_ticker ON lb_positions_cache(ticker);
CREATE INDEX IF NOT EXISTS idx_lb_synced ON lb_positions_cache(synced_at);
