-- Stock Pitch Leaderboard Schema
-- Users submit calls (ticker + direction + thesis + price target).
-- System tracks entry price, current price, performance.
-- Leaderboard ranks by IRR / accuracy over time.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  firm TEXT,
  brand TEXT DEFAULT 'stockpitch',  -- which A/B variant they signed up through
  created_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT,
  tier TEXT DEFAULT 'free',          -- 'free', 'pro', 'white_glove'
  free_portals_used INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- A "call" is a user's investment thesis on a ticker
-- Scored by forward price performance relative to entry price
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL REFERENCES users(id),
  ticker TEXT NOT NULL,
  company TEXT,
  direction TEXT NOT NULL CHECK(direction IN ('long', 'short')),
  rating TEXT NOT NULL CHECK(rating IN ('buy', 'overweight', 'hold', 'underweight', 'sell')),
  price_target REAL NOT NULL,
  entry_price REAL NOT NULL,
  entry_date TEXT NOT NULL,
  time_horizon_months INTEGER DEFAULT 12,
  thesis TEXT,                       -- user's ~100-500 word thesis
  sector TEXT,
  catalyst TEXT,                     -- optional: what they expect to move price
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  close_price REAL,
  close_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  brand TEXT DEFAULT 'stockpitch'    -- which variant the call came in through
);

CREATE INDEX IF NOT EXISTS idx_calls_user ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_ticker ON calls(ticker);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);

-- Current price cache — updated by cron, queried by leaderboard
CREATE TABLE IF NOT EXISTS prices (
  ticker TEXT PRIMARY KEY,
  price REAL NOT NULL,
  change_1d REAL,
  change_1m REAL,
  change_3m REAL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Historical price snapshots — used to compute entry-to-now performance
CREATE TABLE IF NOT EXISTS price_history (
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  price REAL NOT NULL,
  PRIMARY KEY (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_price_history_ticker ON price_history(ticker);

-- Magic-link auth tokens (short-lived)
CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_email ON auth_tokens(email);

-- ========================================================================
-- PORTFOLIOS — v2 layer on top of leaderboard
-- Auto-constructed ("Top 10 by IRR") or curator-built ("Evan's Picks")
-- Users can follow portfolios; performance tracked separately from calls
-- ========================================================================

CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  curator_user_id TEXT REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN (
    'auto_top10',       -- Auto: top 10 calls by IRR, rebalanced weekly
    'auto_by_sector',   -- Auto: top 5 per sector
    'auto_consensus',   -- Auto: tickers with highest agreement among top users
    'curator',          -- Manually constructed by a curator (e.g., Evan)
    'personal'          -- User's own portfolio built from their calls
  )),
  inception_date TEXT DEFAULT (datetime('now')),
  inception_value REAL DEFAULT 100000,
  current_value REAL,
  irr_since_inception REAL,
  visibility TEXT DEFAULT 'public' CHECK(visibility IN ('public', 'subscribers', 'private')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portfolios_type ON portfolios(type);
CREATE INDEX IF NOT EXISTS idx_portfolios_curator ON portfolios(curator_user_id);

-- Positions in a portfolio — each links back to the source call for traceability
CREATE TABLE IF NOT EXISTS portfolio_positions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id),
  call_id TEXT REFERENCES calls(id),     -- source call; nullable for manual curator adds
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('long', 'short')),
  weight_pct REAL NOT NULL DEFAULT 0,    -- portfolio weight
  entry_price REAL NOT NULL,
  entry_date TEXT NOT NULL,
  exit_price REAL,
  exit_date TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'closed')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pp_portfolio ON portfolio_positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pp_ticker ON portfolio_positions(ticker);

-- Followership — users subscribe to a portfolio (free or paid depending on curator)
CREATE TABLE IF NOT EXISTS portfolio_followers (
  user_id TEXT NOT NULL REFERENCES users(id),
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id),
  followed_at TEXT DEFAULT (datetime('now')),
  notifications_enabled INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, portfolio_id)
);

-- Snapshot of portfolio NAV daily for charting performance
CREATE TABLE IF NOT EXISTS portfolio_nav_history (
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id),
  date TEXT NOT NULL,
  nav REAL NOT NULL,
  PRIMARY KEY (portfolio_id, date)
);
