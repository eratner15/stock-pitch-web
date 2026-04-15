-- Demo seed — populates leaderboard with plausible calls so first visitor
-- sees a populated board. Entry prices are backdated 5-21 days.
-- Users are fictional analyst handles. Safe to re-run (uses INSERT OR IGNORE).

-- Demo users
INSERT OR IGNORE INTO users (id, email, display_name, brand, created_at) VALUES
  ('demo_user_001', 'claire.b@example.com',   'Claire B.',    'stockpitch', datetime('now','-21 days')),
  ('demo_user_002', 'marcus.w@example.com',   'Marcus W.',    'stockpitch', datetime('now','-18 days')),
  ('demo_user_003', 'priya.r@example.com',    'Priya R.',     'stockpitch', datetime('now','-14 days')),
  ('demo_user_004', 'daniel.h@example.com',   'Daniel H.',    'stockpitch', datetime('now','-12 days')),
  ('demo_user_005', 'sarah.c@example.com',    'Sarah C.',     'stockpitch', datetime('now','-9 days')),
  ('demo_user_006', 'alex.m@example.com',     'Alex M.',      'stockpitch', datetime('now','-7 days')),
  ('demo_user_007', 'jason.t@example.com',    'Jason T.',     'stockpitch', datetime('now','-5 days'));

-- Demo calls. Entry prices below/above current mock prices to produce visible returns.
INSERT OR IGNORE INTO calls (
  id, user_id, ticker, company, direction, rating, price_target, entry_price, entry_date,
  time_horizon_months, thesis, brand, created_at, status
) VALUES
  (
    'seed_nvda_001', 'demo_user_001', 'NVDA', 'NVIDIA Corp', 'long', 'buy', 220, 152.00,
    datetime('now','-21 days'), 12,
    'Blackwell ramp is pulling hyperscaler capex forward, not substituting. Consensus assumes normalization in FY27 but the unit economics of inference workloads argue for a second leg of TAM expansion through 2028. Networking (NVLink, CX-9) becomes a second growth vector — call it 15% of revenue by 2027, versus consensus essentially zero.',
    'stockpitch', datetime('now','-21 days'), 'open'
  ),
  (
    'seed_pltr_002', 'demo_user_002', 'PLTR', 'Palantir', 'long', 'overweight', 95, 68.40,
    datetime('now','-18 days'), 12,
    'AIP commercial adoption is the story the Street is still missing. The deployment velocity with blue-chip customers suggests material commercial revenue acceleration through 2026. Government renewal risk is real but priced in. Asymmetric setup — 40-60% upside if commercial lands, 15-20% downside if it doesn\''t.',
    'stockpitch', datetime('now','-18 days'), 'open'
  ),
  (
    'seed_bx_003', 'demo_user_003', 'BX', 'Blackstone Inc.', 'long', 'buy', 150, 104.30,
    datetime('now','-14 days'), 12,
    'Priced like a pure credit shop despite 34% credit FEAUM mix. Perpetual capital >40% of AUM and growing. Realization cycle setup with $6.7B of accrued carry. Private wealth inflows accelerating. Peer set (APO, KKR) has higher credit exposure and higher risk — BX is getting Apollo''s multiple without Apollo''s risk profile.',
    'stockpitch', datetime('now','-14 days'), 'open'
  ),
  (
    'seed_tsla_004', 'demo_user_004', 'TSLA', 'Tesla Inc.', 'short', 'underweight', 240, 328.70,
    datetime('now','-12 days'), 6,
    'Auto unit economics are deteriorating faster than the Street models. China pricing war is structural, not cyclical. Robotaxi timeline slipping, and the market has been pricing in FSD victory for three years running. At 75x forward earnings, there is no margin for error on either the auto business or the AI narrative.',
    'stockpitch', datetime('now','-12 days'), 'open'
  ),
  (
    'seed_msgs_005', 'demo_user_005', 'MSGS', 'MSG Sports', 'long', 'overweight', 285, 182.00,
    datetime('now','-9 days'), 18,
    'Knicks/Rangers split finally approved. Forbes SOTP of $13.5B vs market EV of ~$9B = 34% discount. Every prior Dolan spin-off has compressed the conglomerate discount 25-35%. NBA $76B media deal accretes to Knicks Co. directly. Rangers Co. optionality on NHL media renewal. Five-year hold to catalyst completion.',
    'stockpitch', datetime('now','-9 days'), 'open'
  ),
  (
    'seed_avgo_006', 'demo_user_006', 'AVGO', 'Broadcom Inc.', 'long', 'buy', 380, 285.00,
    datetime('now','-7 days'), 9,
    'Custom AI ASIC pipeline with Google, Meta, and now rumored OpenAI is materially under-modeled. VMware integration milestones are hitting schedule. Dividend + buyback yield sits around 3% with 15%+ EPS growth. The narrative is AI-beneficiary-that-isn''t-NVDA, and at 28x forward the multiple has room.',
    'stockpitch', datetime('now','-7 days'), 'open'
  ),
  (
    'seed_snow_007', 'demo_user_007', 'SNOW', 'Snowflake Inc.', 'short', 'hold', 140, 186.00,
    datetime('now','-5 days'), 6,
    'NDR decline curve is steeper than management is signaling. Competition from Databricks and native cloud warehouses is eating at the high end. Consumption model looks great in up cycles, less so when customers optimize. AI revenue is real but small — not enough to offset core compression.',
    'stockpitch', datetime('now','-5 days'), 'open'
  );

-- Pre-populate prices table for the seed tickers so leaderboard has immediate
-- performance without waiting for first cron run
INSERT OR REPLACE INTO prices (ticker, price, change_1d, updated_at) VALUES
  ('NVDA', 168.00, 1.5,  datetime('now')),
  ('PLTR', 72.50,  1.8,  datetime('now')),
  ('BX',   110.00, 0.2,  datetime('now')),
  ('TSLA', 312.50, 2.3,  datetime('now')),
  ('MSGS', 195.00, 0.5,  datetime('now')),
  ('AVGO', 302.00, 0.6,  datetime('now')),
  ('SNOW', 178.00, -0.7, datetime('now'));
