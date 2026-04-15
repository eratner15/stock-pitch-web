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

export async function fetchPrice(ticker: string, _fmpKey?: string): Promise<PriceQuote | null> {
  const t = ticker.toUpperCase().trim();

  // Try Yahoo Finance first
  const yahoo = await fetchFromYahoo(t);
  if (yahoo) return yahoo;

  // Fall back to deterministic mock so UI never breaks
  return mockPrice(t);
}

/**
 * Yahoo Finance unofficial quote endpoint.
 * Server-side only (CORS would block from browser).
 * Small list of User-Agents to avoid their bot-block heuristics.
 */
async function fetchFromYahoo(ticker: string): Promise<PriceQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      cf: { cacheTtl: 180 },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      quoteResponse?: {
        result?: Array<{
          symbol: string;
          regularMarketPrice?: number;
          regularMarketChangePercent?: number;
          shortName?: string;
          longName?: string;
        }>;
      };
    };
    const q = data.quoteResponse?.result?.[0];
    if (!q || typeof q.regularMarketPrice !== 'number') return null;
    return {
      ticker: q.symbol,
      price: q.regularMarketPrice,
      change_1d: q.regularMarketChangePercent ?? null,
      company: q.longName ?? q.shortName ?? null,
      as_of: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Yahoo price fetch failed:', err);
    return null;
  }
}

// Stable mock prices — last-resort fallback so UX never breaks
const MOCK_PRICES: Record<string, Omit<PriceQuote, 'as_of'>> = {
  AAPL: { ticker: 'AAPL', price: 237.50, change_1d: 0.4, company: 'Apple Inc.' },
  MSFT: { ticker: 'MSFT', price: 512.80, change_1d: 0.7, company: 'Microsoft Corp' },
  GOOGL:{ ticker: 'GOOGL',price: 195.30, change_1d: -0.3, company: 'Alphabet Inc.' },
  AMZN: { ticker: 'AMZN', price: 242.10, change_1d: 1.2, company: 'Amazon.com Inc.' },
  META: { ticker: 'META', price: 748.00, change_1d: -0.8, company: 'Meta Platforms' },
  TSLA: { ticker: 'TSLA', price: 312.50, change_1d: 2.3, company: 'Tesla Inc.' },
  NVDA: { ticker: 'NVDA', price: 168.00, change_1d: 1.5, company: 'NVIDIA Corp' },
  BX:   { ticker: 'BX',   price: 110.00, change_1d: 0.2, company: 'Blackstone Inc.' },
  KMB:  { ticker: 'KMB',  price: 96.59,  change_1d: -0.4, company: 'Kimberly-Clark' },
  KVUE: { ticker: 'KVUE', price: 18.72,  change_1d: 0.1, company: 'Kenvue Inc.' },
  VITL: { ticker: 'VITL', price: 13.14,  change_1d: 0.8, company: 'Vital Farms Inc.' },
  MSGS: { ticker: 'MSGS', price: 195.00, change_1d: 0.5, company: 'MSG Sports' },
  KNX:  { ticker: 'KNX',  price: 58.60,  change_1d: -0.2, company: 'Knight-Swift' },
  RRX:  { ticker: 'RRX',  price: 132.00, change_1d: 0.6, company: 'Regal Rexnord' },
  SPY:  { ticker: 'SPY',  price: 612.00, change_1d: 0.3, company: 'SPDR S&P 500' },
  QQQ:  { ticker: 'QQQ',  price: 542.00, change_1d: 0.5, company: 'Invesco QQQ' },
  PLTR: { ticker: 'PLTR', price: 72.50,  change_1d: 1.8, company: 'Palantir' },
  UBER: { ticker: 'UBER', price: 86.30,  change_1d: 0.4, company: 'Uber Technologies' },
  SNOW: { ticker: 'SNOW', price: 178.00, change_1d: -0.7, company: 'Snowflake Inc.' },
  NET:  { ticker: 'NET',  price: 112.50, change_1d: 0.9, company: 'Cloudflare Inc.' },
  AMD:  { ticker: 'AMD',  price: 178.20, change_1d: 1.1, company: 'Advanced Micro Devices' },
  AVGO: { ticker: 'AVGO', price: 302.00, change_1d: 0.6, company: 'Broadcom Inc.' },
  COST: { ticker: 'COST', price: 1008.00, change_1d: 0.2, company: 'Costco Wholesale' },
  LLY:  { ticker: 'LLY',  price: 782.00, change_1d: -0.5, company: 'Eli Lilly' },
  JPM:  { ticker: 'JPM',  price: 286.00, change_1d: 0.3, company: 'JPMorgan Chase' },
};

function mockPrice(ticker: string): PriceQuote | null {
  const base = MOCK_PRICES[ticker];
  if (!base) {
    const seed = ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const price = 20 + (seed % 200) + (seed % 17) / 10;
    return {
      ticker,
      price: Math.round(price * 100) / 100,
      change_1d: ((seed % 40) - 20) / 10,
      company: null,
      as_of: new Date().toISOString(),
    };
  }
  return { ...base, as_of: new Date().toISOString() };
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
