/**
 * LiquidityBook API Client — ported from lcs-portfolio-intel.
 * Uses REQUESTS KV for token caching (shared with stock-pitch).
 * Provides position retrieval, order submission, and basket management.
 */

const LB_BASE = 'https://blotter.liquiditybook.com';
const TOKEN_CACHE_KEY = 'lb_token';
const TOKEN_TTL_SECONDS = 55 * 60;

export interface LBPositionRow {
  AxysCode: string;
  Ticker: string;
  AssetClass: string;
  Side: string;
  NETPos: string;
  SODPos: string;
  DAYPos: string;
  LastPx: string;
  SODPx: string;
  MktValBase: string;
  NetBasisPx: string;
  ExpAumPct: string;
  pnlUSD: string;
  PnlMTD: string;
  PnlYTD: string;
  Description: string;
  CUSIP: string;
  ISIN: string;
  SEDOL: string;
  'Px Change': string;
  TARGETPos: string;
}

interface LBEnv {
  REQUESTS: KVNamespace;
  LIQUIDITYBOOK_CLIENT_ID: string;
  LIQUIDITYBOOK_CLIENT_SECRET: string;
}

export class LBClient {
  constructor(private env: LBEnv) {}

  async getToken(): Promise<string> {
    const cached = await this.env.REQUESTS.get(TOKEN_CACHE_KEY);
    if (cached) return cached;

    const resp = await this.fetchWithRetry(`${LB_BASE}/apiauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.env.LIQUIDITYBOOK_CLIENT_ID,
        client_secret: this.env.LIQUIDITYBOOK_CLIENT_SECRET,
      }),
    });

    if (!resp.ok) throw new Error(`LB auth failed: ${resp.status} ${await resp.text()}`);
    const data = (await resp.json()) as { access_token: string };
    await this.env.REQUESTS.put(TOKEN_CACHE_KEY, data.access_token, { expirationTtl: TOKEN_TTL_SECONDS });
    return data.access_token;
  }

  async startPositionsQuery(filters?: string): Promise<string> {
    const accessToken = await this.getToken();
    const params = new URLSearchParams({ async: 'true' });
    if (filters) params.set('filters', filters);

    const resp = await this.fetchWithRetry(
      `${LB_BASE}/api/v2/report/API_Positions_Retrieve?${params}`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );

    if (!resp.ok) throw new Error(`LB positions request failed: ${resp.status} ${await resp.text()}`);
    const data = await resp.json() as any;
    const token = data.tokens?.[0] || data.token;
    if (!token) throw new Error('LB did not return an async token');
    return token;
  }

  async pollForResults(asyncToken: string): Promise<any[]> {
    const accessToken = await this.getToken();
    const resp = await this.fetchWithRetry(
      `${LB_BASE}/api/v2/report/status/${asyncToken}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resp.ok) throw new Error(`LB poll failed: ${resp.status}`);
    const data = await resp.json() as any;
    if (data.status === 'complete' || data.result?.data) return data.result?.data || [];
    return [];
  }

  async getPositions(): Promise<LBPositionRow[]> {
    const token = await this.startPositionsQuery();
    const intervals = [10000, 10000, 10000, 10000, 15000, 15000, 15000, 15000, 20000, 20000, 20000, 20000];
    for (const wait of intervals) {
      await new Promise(r => setTimeout(r, wait));
      try {
        const rows = await this.pollForResults(token);
        if (rows.length > 0) return rows as LBPositionRow[];
      } catch (e: any) {
        if (e.message?.includes('429')) { await new Promise(r => setTimeout(r, 30000)); continue; }
        throw e;
      }
    }
    throw new Error('LB positions query timed out after ~3 minutes');
  }

  async getAccountPositions(axysCode: string): Promise<LBPositionRow[]> {
    const token = await this.startPositionsQuery('Account.AxysCode~=~' + axysCode);
    const intervals = [5000, 5000, 10000, 10000, 15000, 15000, 15000, 15000];
    for (const wait of intervals) {
      await new Promise(r => setTimeout(r, wait));
      try {
        const rows = await this.pollForResults(token);
        if (rows.length > 0) return rows as LBPositionRow[];
      } catch (e: any) {
        if (e.message?.includes('429')) { await new Promise(r => setTimeout(r, 15000)); continue; }
        throw e;
      }
    }
    return [];
  }

  async submitOrder(params: {
    ticker: string;
    side: 'BUY' | 'SELL';
    totalShares: number;
    allocations: { axysCode: string; shares: number }[];
    limitPrice?: number;
  }): Promise<{ orderId: string; status: string; raw: any }> {
    const accessToken = await this.getToken();
    const orders = params.allocations.filter(a => Math.abs(a.shares) > 0).map(a => ({
      assetClass: 'EQUITY', currency: 'USD', destination: 'PARENT', duration: 'DAY',
      side: params.side, size: String(Math.abs(a.shares)), symbol: params.ticker,
      px: params.limitPrice ? String(params.limitPrice) : '', acct: a.axysCode,
      clientOrderId: crypto.randomUUID(),
    }));
    if (orders.length === 0) throw new Error('No valid allocations to submit');

    const resp = await this.fetchWithRetry(
      `${LB_BASE}/apireport?svc=getReport&reportName=API_Order_Create`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ orders }) }
    );
    const data = await resp.json() as any;
    if (data.rc !== 0 && data.rc !== undefined) throw new Error(`LB order failed: rc=${data.rc}`);
    const report = data.report || [];
    return { orderId: report[0]?.OrderId || '', status: data.status || 'submitted', raw: data };
  }

  private async fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const resp = await fetch(url, init);
      if (resp.status === 429) {
        const waitMs = (attempt + 1) * 15000;
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
      if (resp.status === 200) {
        const text = await resp.text();
        try {
          const json = JSON.parse(text);
          if (json.error?.includes('concurrent')) { await new Promise(r => setTimeout(r, 30000)); continue; }
          return new Response(text, { status: 200, headers: resp.headers });
        } catch { return new Response(text, { status: 200, headers: resp.headers }); }
      }
      return resp;
    }
    throw new Error(`LB rate limited after ${maxRetries} retries`);
  }
}

/**
 * Sync LB positions to D1 cache table.
 * Called by cron (scheduled handler) during market hours.
 */
export async function syncLBPositions(env: LBEnv & { DB: D1Database }): Promise<number> {
  const client = new LBClient(env);
  const positions = await client.getPositions();

  // Clear old cache and insert fresh
  await env.DB.prepare('DELETE FROM lb_positions_cache').run();

  let count = 0;
  for (const p of positions) {
    if (!p.Ticker) continue;
    await env.DB.prepare(
      `INSERT INTO lb_positions_cache (ticker, axys_code, account_name, side, shares, last_price, market_value, cost_basis, pnl_day, pnl_mtd, pnl_ytd, weight_pct, asset_class, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      p.Ticker, p.AxysCode, p.Description || '', p.Side || 'LONG',
      parseFloat(p.NETPos) || 0, parseFloat(p.LastPx) || 0,
      parseFloat(p.MktValBase) || 0, parseFloat(p.NetBasisPx) || 0,
      parseFloat(p.pnlUSD) || 0, parseFloat(p.PnlMTD) || 0, parseFloat(p.PnlYTD) || 0,
      parseFloat(p.ExpAumPct) || 0, p.AssetClass || 'EQUITY'
    ).run();
    count++;
  }

  return count;
}
