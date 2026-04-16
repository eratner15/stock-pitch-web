/**
 * Price data — tiered source strategy:
 *   1. D1 prices table (populated by cron; fastest, hits LCS book + recently looked up)
 *   2. Yahoo Finance (free, no key, works for any US ticker — server-side only)
 *   3. Deterministic mock (so UI works in dev/demo without network)
 *
 * LiquidityBook is NOT used for live submit lookups — its async positions API
 * has a ~100-second poll cycle and 1-concurrent-call limit. LB is better suited
 * to a nightly batch cache for LCS-book tickers, which is planned as a v2
 * enhancement (nightly cron syncs LB positions → writes to D1 prices table).
 */

export interface PriceQuote {
  ticker: string;
  price: number;
  change_1d: number | null;
  company: string | null;
  as_of: string;
}

/**
 * Primary price lookup — Yahoo v8 only, no mock fallback.
 *
 * Previously this function fell back to a deterministic hash-of-ticker fake
 * price so the UI "never broke." That was a credibility bug — tickers we
 * couldn't actually price rendered with fabricated numbers (e.g. WING
 * showed a made-up $87 instead of its real $198 close). Never again.
 *
 * Read-path callers must handle `null` (skip the row, show em-dash, etc.).
 */
export async function fetchPrice(ticker: string, _fmpKey?: string): Promise<PriceQuote | null> {
  const t = ticker.toUpperCase().trim();
  // Yahoo uses hyphens for share-class (BRK-B), SEC uses dots (BRK.B).
  // Try the original, then swap.
  const primary = await fetchFromYahoo(t);
  if (primary) return primary;
  if (t.includes('.')) return await fetchFromYahoo(t.replace(/\./g, '-'));
  if (t.includes('-')) return await fetchFromYahoo(t.replace(/-/g, '.'));
  return null;
}

/**
 * Strict price lookup — real source only. Used when ACCEPTING a new call.
 * If Yahoo can't price the ticker, we reject the submission rather than
 * silently inventing an entry price. The `opts` arg is kept for backward
 * compat; the demo fallback is no longer honored because the baked-in
 * MOCK_PRICES list was months-stale and caused credibility bugs (e.g. a
 * user pitched WING and got the wrong closing price).
 */
export async function fetchPriceStrict(
  ticker: string,
  _opts?: { allowDemoFallback?: boolean }
): Promise<PriceQuote | null> {
  // Reuse fetchPrice which handles BRK.B ↔ BRK-B normalization.
  return await fetchPrice(ticker);
}

/**
 * Yahoo Finance price lookup — uses the v8 chart endpoint.
 *
 * Why not v7/finance/quote? Yahoo started returning "Unauthorized" on that
 * endpoint in 2024–25. v8/finance/chart is the canonical endpoint that
 * still works unauthenticated and returns real-time prices + meta for any
 * US-listed ticker. The meta block gives us price, name, and previous
 * close so we can compute change_1d ourselves.
 */
async function fetchFromYahoo(ticker: string): Promise<PriceQuote | null> {
  try {
    // range=5d so we have a reliable previousClose even if today hasn't printed
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      cf: { cacheTtl: 180 },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      chart?: {
        result?: Array<{
          meta?: {
            symbol?: string;
            regularMarketPrice?: number;
            previousClose?: number | null;
            chartPreviousClose?: number;
            shortName?: string;
            longName?: string;
            instrumentType?: string;
            regularMarketTime?: number;
          };
        }>;
        error?: unknown;
      };
    };
    const m = data.chart?.result?.[0]?.meta;
    if (!m || typeof m.regularMarketPrice !== 'number') return null;
    if (m.instrumentType && m.instrumentType !== 'EQUITY' && m.instrumentType !== 'ETF') {
      // Reject options, futures, crypto-style symbols etc. for now.
      return null;
    }
    const prev = m.previousClose ?? m.chartPreviousClose;
    const change_1d = typeof prev === 'number' && prev > 0
      ? (m.regularMarketPrice - prev) / prev
      : null;
    return {
      ticker: m.symbol ?? ticker.toUpperCase(),
      price: m.regularMarketPrice,
      change_1d,
      company: m.longName ?? m.shortName ?? null,
      as_of: m.regularMarketTime
        ? new Date(m.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
    };
  } catch (err) {
    console.error('Yahoo v8 price fetch failed:', err);
    return null;
  }
}

/**
 * 1-year daily close series via Yahoo v8 chart endpoint. Used by the
 * portal memo's price chart. Returns [{t: ms, c: close}, ...].
 */
export async function fetchPriceHistory(ticker: string): Promise<Array<{ t: number; c: number }>> {
  const t = ticker.toUpperCase().trim();
  const tries = [t, t.replace(/\./g, '-'), t.replace(/-/g, '.')];
  for (const sym of tries) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1y`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        cf: { cacheTtl: 3600 },
      });
      if (!res.ok) continue;
      const data = await res.json() as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          }>;
        };
      };
      const r = data.chart?.result?.[0];
      const ts = r?.timestamp;
      const closes = r?.indicators?.quote?.[0]?.close;
      if (!ts || !closes) continue;
      const out: Array<{ t: number; c: number }> = [];
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c === 'number' && Number.isFinite(c)) {
          out.push({ t: ts[i] * 1000, c });
        }
      }
      if (out.length >= 5) return out;
    } catch (err) {
      continue;
    }
  }
  return [];
}

export function calcReturn(
  entry: number,
  current: number,
  direction: 'long' | 'short'
): number {
  if (entry <= 0) return 0;
  const pct = (current - entry) / entry;
  return direction === 'long' ? pct : -pct;
}

export function annualize(returnPct: number, days: number): number {
  if (days <= 0) return 0;
  return Math.pow(1 + returnPct, 365 / days) - 1;
}
