/**
 * Portfolio construction, rebalance, and NAV math.
 *
 * Design:
 * - A portfolio has positions, each with a locked entry_price captured at
 *   the moment the portfolio opened the position (NOT the analyst's original
 *   call entry — portfolio track record is separate from analyst track record).
 * - Auto portfolios (type='auto_top10') rebalance nightly if composition
 *   changes. On rebalance: close positions no longer qualifying (record
 *   exit_price), open new ones (lock current price as entry).
 * - NAV is computed each night and snapshotted to portfolio_nav_history for
 *   the chart. Formula:
 *     NAV_today = last_rebalance_NAV * (1 + weighted_avg_return_since_rebalance)
 *   This cleanly handles rebalance days (NAV carries through, positions reset).
 */

import { fetchPrice, calcReturn } from './prices';
import { newId } from './security';

export interface PortfolioRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  inception_date: string;
  inception_value: number;
  current_value: number | null;
  irr_since_inception: number | null;
  visibility: string;
  created_at: string;
}

export interface PortfolioPositionRow {
  id: string;
  portfolio_id: string;
  call_id: string | null;
  ticker: string;
  direction: 'long' | 'short';
  weight_pct: number;
  entry_price: number;
  entry_date: string;
  exit_price: number | null;
  exit_date: string | null;
  status: 'open' | 'closed';
  created_at: string;
}

const TOP_N = 10;
const EQUAL_WEIGHT = 100 / TOP_N; // 10%

/**
 * Ensure the "Top 10 by IRR" portfolio exists. Idempotent — safe to call
 * on every cron tick. Returns the portfolio id.
 */
export async function ensureTopTenPortfolio(db: D1Database): Promise<string> {
  const existing = await db
    .prepare('SELECT id FROM portfolios WHERE slug = ?')
    .bind('top10')
    .first<{ id: string }>();
  if (existing) return existing.id;

  const id = newId();
  await db
    .prepare(
      `INSERT INTO portfolios (
        id, slug, name, description, type, inception_date, inception_value,
        current_value, visibility, created_at
      ) VALUES (?, ?, ?, ?, 'auto_top10', datetime('now'), 100000, 100000, 'public', datetime('now'))`
    )
    .bind(
      id,
      'top10',
      'Top 10 by IRR',
      "The ten open calls with the highest annualized return. Rebalanced nightly. Equal-weighted. Entry prices locked at the moment each position entered the portfolio — not the analyst's original entry."
    )
    .run();
  return id;
}

/**
 * Rebalance the Top 10 portfolio.
 *
 * 1. Pull all open calls with current prices
 * 2. Rank by annualized IRR
 * 3. Compute target set (top 10 unique tickers — dedup in case two analysts have same pick)
 * 4. Compare to current open positions
 * 5. Close positions no longer in the set (exit_price = current)
 * 6. Open new positions (entry_price = current)
 * 7. Return a summary of changes
 */
export async function rebalanceTopTen(
  db: D1Database,
  portfolioId: string
): Promise<{ opened: number; closed: number; held: number; ticker_set: string[] }> {
  // Pull all open calls joined with latest price
  const callsRes = await db
    .prepare(
      `SELECT c.id AS call_id, c.ticker, c.direction, c.entry_price, c.entry_date,
              p.price AS current_price
       FROM calls c
       LEFT JOIN prices p ON p.ticker = c.ticker
       WHERE c.status = 'open'`
    )
    .all<{
      call_id: string;
      ticker: string;
      direction: 'long' | 'short';
      entry_price: number;
      entry_date: string;
      current_price: number | null;
    }>();
  const calls = callsRes.results ?? [];

  const now = new Date();
  const nowIso = now.toISOString();

  // Score each call by annualized IRR since its entry
  const scored = calls
    .filter(c => c.current_price != null && c.current_price > 0)
    .map(c => {
      const ret = calcReturn(c.entry_price, c.current_price!, c.direction);
      const days = Math.max(
        1,
        Math.floor((now.getTime() - new Date(c.entry_date).getTime()) / 86400000)
      );
      const annualized = Math.pow(1 + ret, 365 / days) - 1;
      return { ...c, return_pct: ret, annualized_pct: annualized };
    })
    .sort((a, b) => b.annualized_pct - a.annualized_pct);

  // Top-N by unique ticker. If two analysts have the same ticker in the same
  // direction, the higher-ranked one wins — keep the better-performing call_id.
  const targetByTicker = new Map<string, typeof scored[0]>();
  for (const c of scored) {
    const key = `${c.ticker}:${c.direction}`;
    if (!targetByTicker.has(key)) targetByTicker.set(key, c);
    if (targetByTicker.size >= TOP_N) break;
  }
  const targetSet = Array.from(targetByTicker.values());
  const targetKeys = new Set(targetSet.map(t => `${t.ticker}:${t.direction}`));

  // Pull current open portfolio positions
  const posRes = await db
    .prepare(
      `SELECT id, ticker, direction, entry_price, call_id
       FROM portfolio_positions
       WHERE portfolio_id = ? AND status = 'open'`
    )
    .bind(portfolioId)
    .all<{
      id: string;
      ticker: string;
      direction: 'long' | 'short';
      entry_price: number;
      call_id: string | null;
    }>();
  const currentPositions = posRes.results ?? [];
  const currentKeys = new Set(currentPositions.map(p => `${p.ticker}:${p.direction}`));

  let closed = 0;
  let opened = 0;
  let held = 0;

  // Close positions that fell out
  for (const pos of currentPositions) {
    const key = `${pos.ticker}:${pos.direction}`;
    if (targetKeys.has(key)) {
      held++;
      continue;
    }
    // Get current price to record exit
    const exitQuote = await fetchPrice(pos.ticker);
    const exitPrice = exitQuote?.price ?? pos.entry_price;
    await db
      .prepare(
        `UPDATE portfolio_positions
         SET status = 'closed', exit_price = ?, exit_date = ?
         WHERE id = ?`
      )
      .bind(exitPrice, nowIso, pos.id)
      .run();
    closed++;
  }

  // Open new positions
  for (const t of targetSet) {
    const key = `${t.ticker}:${t.direction}`;
    if (currentKeys.has(key)) continue;
    const posId = newId();
    await db
      .prepare(
        `INSERT INTO portfolio_positions (
          id, portfolio_id, call_id, ticker, direction, weight_pct,
          entry_price, entry_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))`
      )
      .bind(
        posId,
        portfolioId,
        t.call_id,
        t.ticker,
        t.direction,
        EQUAL_WEIGHT,
        t.current_price!,
        nowIso
      )
      .run();
    opened++;
  }

  // Re-weight all open positions to equal weight (handles partial fills)
  const openCount = held + opened;
  if (openCount > 0) {
    const newWeight = 100 / openCount;
    await db
      .prepare(
        `UPDATE portfolio_positions SET weight_pct = ?
         WHERE portfolio_id = ? AND status = 'open'`
      )
      .bind(newWeight, portfolioId)
      .run();
  }

  return {
    opened,
    closed,
    held,
    ticker_set: targetSet.map(t => `${t.ticker} ${t.direction}`),
  };
}

/**
 * Compute current NAV for a portfolio.
 *
 * Formula:
 *   For each open position:
 *     return_contribution = (current_price - entry_price) / entry_price * direction_sign
 *     weighted_contribution = return_contribution * (weight_pct / 100)
 *   NAV = last_rebalance_NAV * (1 + sum(weighted_contributions))
 *
 * Since rebalance resets weights and entry_prices, this formula naturally
 * tracks performance since the most recent rebalance. For a cleaner story we
 * approximate "since inception" by compounding NAV snapshots (see below).
 */
export async function computeCurrentNAV(
  db: D1Database,
  portfolioId: string
): Promise<{ nav: number; positions_with_perf: PositionPerf[]; total_return_pct: number }> {
  const portfolio = await db
    .prepare('SELECT * FROM portfolios WHERE id = ?')
    .bind(portfolioId)
    .first<PortfolioRow>();
  if (!portfolio) throw new Error('Portfolio not found');

  const posRes = await db
    .prepare(
      `SELECT pp.id, pp.ticker, pp.direction, pp.weight_pct, pp.entry_price, pp.entry_date, pp.call_id,
              p.price AS current_price
       FROM portfolio_positions pp
       LEFT JOIN prices p ON p.ticker = pp.ticker
       WHERE pp.portfolio_id = ? AND pp.status = 'open'`
    )
    .bind(portfolioId)
    .all<{
      id: string;
      ticker: string;
      direction: 'long' | 'short';
      weight_pct: number;
      entry_price: number;
      entry_date: string;
      call_id: string | null;
      current_price: number | null;
    }>();
  const positions = posRes.results ?? [];

  const now = new Date();
  let weightedReturn = 0;
  const positionsWithPerf: PositionPerf[] = [];

  for (const pos of positions) {
    if (pos.current_price == null) continue;
    const ret = calcReturn(pos.entry_price, pos.current_price, pos.direction);
    const contribution = ret * (pos.weight_pct / 100);
    weightedReturn += contribution;
    const days = Math.max(
      1,
      Math.floor((now.getTime() - new Date(pos.entry_date).getTime()) / 86400000)
    );
    positionsWithPerf.push({
      id: pos.id,
      ticker: pos.ticker,
      direction: pos.direction,
      weight_pct: pos.weight_pct,
      entry_price: pos.entry_price,
      entry_date: pos.entry_date,
      current_price: pos.current_price,
      return_pct: ret,
      weighted_contribution: contribution,
      days_held: days,
      call_id: pos.call_id,
    });
  }

  // Use last NAV snapshot as baseline. If no snapshot, use inception_value.
  const lastNavRow = await db
    .prepare(
      `SELECT nav FROM portfolio_nav_history
       WHERE portfolio_id = ?
       ORDER BY date DESC LIMIT 1`
    )
    .bind(portfolioId)
    .first<{ nav: number }>();
  const baselineNav = lastNavRow?.nav ?? portfolio.inception_value;
  const nav = baselineNav * (1 + weightedReturn);

  return {
    nav,
    positions_with_perf: positionsWithPerf,
    total_return_pct: (nav - portfolio.inception_value) / portfolio.inception_value,
  };
}

/**
 * Take a NAV snapshot for today. Called by nightly cron. Idempotent on
 * (portfolio_id, date) — re-running the same day replaces the snapshot.
 */
export async function snapshotNAV(db: D1Database, portfolioId: string): Promise<number> {
  const { nav } = await computeCurrentNAV(db, portfolioId);
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await db
    .prepare(
      `INSERT OR REPLACE INTO portfolio_nav_history (portfolio_id, date, nav)
       VALUES (?, ?, ?)`
    )
    .bind(portfolioId, date, nav)
    .run();

  // Update portfolio.current_value + IRR rollup
  const portfolio = await db
    .prepare('SELECT inception_value, inception_date FROM portfolios WHERE id = ?')
    .bind(portfolioId)
    .first<{ inception_value: number; inception_date: string }>();
  if (portfolio) {
    const totalReturn = (nav - portfolio.inception_value) / portfolio.inception_value;
    const days = Math.max(
      1,
      Math.floor((Date.now() - new Date(portfolio.inception_date).getTime()) / 86400000)
    );
    const irr = Math.pow(1 + totalReturn, 365 / days) - 1;
    await db
      .prepare('UPDATE portfolios SET current_value = ?, irr_since_inception = ? WHERE id = ?')
      .bind(nav, irr, portfolioId)
      .run();
  }

  return nav;
}

/** Fetch the NAV history for a portfolio. Returns array in date ascending order. */
export async function getNavHistory(
  db: D1Database,
  portfolioId: string,
  limitDays = 90
): Promise<Array<{ date: string; nav: number }>> {
  const res = await db
    .prepare(
      `SELECT date, nav FROM portfolio_nav_history
       WHERE portfolio_id = ?
       ORDER BY date DESC LIMIT ?`
    )
    .bind(portfolioId, limitDays)
    .all<{ date: string; nav: number }>();
  return (res.results ?? []).reverse();
}

export interface PositionPerf {
  id: string;
  ticker: string;
  direction: 'long' | 'short';
  weight_pct: number;
  entry_price: number;
  entry_date: string;
  current_price: number;
  return_pct: number;
  weighted_contribution: number;
  days_held: number;
  call_id: string | null;
}
