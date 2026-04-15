import { Hono } from 'hono';
import puppeteer from '@cloudflare/puppeteer';
import { renderStockPitchLanding } from './brands/stockpitch';
import { renderLevinCapLanding } from './brands/levincap';
import { renderSubmitV2 } from './pages/submit-v2';
import { renderLeaderboard, initialsFrom, daysBetween, type LeaderboardRow } from './pages/leaderboard';
import { renderCallDetail } from './pages/call-detail';
import { renderShareCardHTML } from './pages/share-card';
import { PORTFOLIO } from './portfolio';
import { fetchPrice, calcReturn } from './lib/prices';
import { generateBrief } from './lib/ai-brief';

interface Env {
  DB: D1Database;
  REQUESTS: KVNamespace;
  AI: any;
  BROWSER: Fetcher;
  FMP_API_KEY?: string;
  ENVIRONMENT: string;
}

type Brand = 'stockpitch' | 'levincap';

function detectBrand(host: string): Brand {
  if (host.includes('levincap.com')) return 'levincap';
  return 'stockpitch';
}

function getOrigin(c: any): string {
  const host = c.req.header('host') || 'stock-pitch-web.evan-ratner.workers.dev';
  const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  return `${proto}://${host}`;
}

const app = new Hono<{ Bindings: Env; Variables: { brand: Brand } }>();

app.use('*', async (c, next) => {
  const host = c.req.header('host') || '';
  c.set('brand', detectBrand(host));
  await next();
});

// ==========================================================================
// LANDING
// ==========================================================================
app.get('/', (c) => {
  const brand = c.get('brand');
  const html = brand === 'levincap'
    ? renderLevinCapLanding(PORTFOLIO)
    : renderStockPitchLanding(PORTFOLIO);
  return c.html(html);
});

// ==========================================================================
// SUBMIT — progressive step-based flow
// ==========================================================================
app.get('/submit', (c) => c.html(renderSubmitV2(c.get('brand'))));

// ==========================================================================
// LEADERBOARD
// ==========================================================================
app.get('/leaderboard', async (c) => {
  const brand = c.get('brand');
  try {
    const rows = await buildLeaderboard(c.env);
    return c.html(renderLeaderboard(rows, brand));
  } catch (err) {
    console.error('Leaderboard error:', err);
    return c.html(renderLeaderboard([], brand));
  }
});

// ==========================================================================
// CALL DETAIL — /c/:id — the research report page
// ==========================================================================
app.get('/c/:id', async (c) => {
  const id = c.req.param('id');
  const call = await c.env.DB.prepare(`
    SELECT c.id, c.ticker, c.direction, c.rating, c.entry_price, c.entry_date,
           c.price_target, c.time_horizon_months, c.thesis, c.catalyst, c.company,
           u.display_name,
           p.price AS current_price
    FROM calls c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN prices p ON p.ticker = c.ticker
    WHERE c.id = ?
  `).bind(id).first<any>();

  if (!call) return c.text('Call not found', 404);

  // Try to pull cached brief from KV; if none, generate on the fly
  let brief = await c.env.REQUESTS.get(`brief:${id}`);
  if (!brief) {
    brief = await generateBrief(c.env.AI, {
      ticker: call.ticker,
      company: call.company,
      direction: call.direction,
      rating: call.rating,
      entry_price: call.entry_price,
      price_target: call.price_target,
      time_horizon_months: call.time_horizon_months,
      thesis: call.thesis,
      display_name: call.display_name,
    });
    // Cache for future views
    try {
      await c.env.REQUESTS.put(`brief:${id}`, brief, { expirationTtl: 30 * 86400 });
    } catch (e) {}
  }

  // Compute return if we have current price
  let returnPct = 0;
  let currentPrice = call.current_price as number | null;
  if (currentPrice == null) {
    const quote = await fetchPrice(call.ticker, c.env.FMP_API_KEY);
    if (quote) {
      currentPrice = quote.price;
      try {
        await c.env.DB.prepare(`
          INSERT OR REPLACE INTO prices (ticker, price, change_1d, updated_at)
          VALUES (?, ?, ?, datetime('now'))
        `).bind(call.ticker, quote.price, quote.change_1d ?? null).run();
      } catch (e) {}
    }
  }
  if (currentPrice != null) {
    returnPct = calcReturn(call.entry_price, currentPrice, call.direction);
  }

  const now = new Date().toISOString();
  const daysHeld = daysBetween(call.entry_date, now);

  return c.html(renderCallDetail({
    id: call.id,
    ticker: call.ticker,
    company: call.company,
    direction: call.direction,
    rating: call.rating,
    entry_price: call.entry_price,
    current_price: currentPrice,
    price_target: call.price_target,
    entry_date: call.entry_date,
    time_horizon_months: call.time_horizon_months,
    thesis: call.thesis,
    catalyst: call.catalyst,
    display_name: call.display_name,
    brief_markdown: brief,
    days_held: daysHeld,
    return_pct: returnPct,
  }, c.get('brand'), getOrigin(c)));
});

// ==========================================================================
// SHARE CARD — /c/:id/og.png (auto-generated via Browser Rendering)
// ==========================================================================
app.get('/c/:id/og.png', async (c) => {
  const id = c.req.param('id');
  const origin = getOrigin(c);

  try {
    const browser = await puppeteer.launch(c.env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.goto(`${origin}/c/${id}/card`, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => (document as any).fonts.ready);
    const png = await page.screenshot({ type: 'png', fullPage: false, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await browser.close();
    return new Response(png as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',  // cache 24h
      },
    });
  } catch (err) {
    console.error('OG generation error:', err);
    return c.text('Share card unavailable', 500);
  }
});

// ==========================================================================
// SHARE CARD HTML — the thing the browser renders before screenshot
// ==========================================================================
app.get('/c/:id/card', async (c) => {
  const id = c.req.param('id');
  const call = await c.env.DB.prepare(`
    SELECT c.ticker, c.direction, c.rating, c.entry_price, c.price_target, c.company,
           u.display_name, p.price AS current_price
    FROM calls c JOIN users u ON u.id = c.user_id
    LEFT JOIN prices p ON p.ticker = c.ticker
    WHERE c.id = ?
  `).bind(id).first<any>();
  if (!call) return c.text('Not found', 404);

  const returnPct = call.current_price != null ? calcReturn(call.entry_price, call.current_price, call.direction) : 0;

  return c.html(renderShareCardHTML({
    ticker: call.ticker,
    company: call.company,
    direction: call.direction,
    rating: call.rating,
    entry_price: call.entry_price,
    current_price: call.current_price,
    price_target: call.price_target,
    return_pct: returnPct,
    display_name: call.display_name,
    brand: c.get('brand'),
  }));
});

// ==========================================================================
// API: submit a call (now also triggers AI brief generation async)
// ==========================================================================
app.post('/api/calls', async (c) => {
  try {
    const body = await c.req.json<{
      ticker: string;
      email: string;
      display_name: string;
      direction: 'long' | 'short';
      rating: string;
      price_target: number;
      entry_price: number;
      time_horizon_months?: number;
      catalyst?: string;
      thesis: string;
      firm?: string;
    }>();

    if (!body.ticker || !body.email || !body.display_name || !body.direction || !body.rating) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    if (!body.price_target || body.price_target <= 0) return c.json({ error: 'Price target must be positive' }, 400);
    if (!body.entry_price || body.entry_price <= 0) return c.json({ error: 'Entry price must be positive' }, 400);
    if (!body.thesis || body.thesis.length < 100) return c.json({ error: 'Thesis must be at least 100 characters' }, 400);

    const ticker = body.ticker.toUpperCase().trim();
    const email = body.email.trim().toLowerCase();
    const brand = c.get('brand');

    const userId = await upsertUser(c.env.DB, email, body.display_name.trim(), brand);

    // Lock in company name too if we can
    const priceQuote = await fetchPrice(ticker, c.env.FMP_API_KEY);

    const callId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const entryDate = new Date().toISOString();
    await c.env.DB.prepare(`
      INSERT INTO calls (
        id, user_id, ticker, company, direction, rating, price_target, entry_price, entry_date,
        time_horizon_months, thesis, catalyst, brand, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      callId,
      userId,
      ticker,
      priceQuote?.company ?? null,
      body.direction,
      body.rating,
      body.price_target,
      body.entry_price,
      entryDate,
      body.time_horizon_months ?? 12,
      body.thesis,
      body.catalyst ?? null,
      brand
    ).run();

    if (priceQuote) {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO prices (ticker, price, change_1d, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(ticker, priceQuote.price, priceQuote.change_1d ?? null).run();
    }

    // Fire-and-forget AI brief generation (cached in KV for subsequent views)
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const brief = await generateBrief(c.env.AI, {
            ticker,
            company: priceQuote?.company ?? null,
            direction: body.direction,
            rating: body.rating,
            entry_price: body.entry_price,
            price_target: body.price_target,
            time_horizon_months: body.time_horizon_months ?? 12,
            thesis: body.thesis,
            display_name: body.display_name.trim(),
          });
          await c.env.REQUESTS.put(`brief:${callId}`, brief, { expirationTtl: 30 * 86400 });
        } catch (err) {
          console.error('Background brief generation failed:', err);
        }
      })()
    );

    return c.json({ success: true, id: callId });
  } catch (err) {
    console.error('Call submit error:', err);
    return c.json({ error: 'Failed to submit call' }, 500);
  }
});

// ==========================================================================
// API: price lookup (used by submit flow)
// ==========================================================================
app.get('/api/price', async (c) => {
  const ticker = c.req.query('ticker')?.toUpperCase().trim();
  if (!ticker) return c.json({ error: 'ticker required' }, 400);
  const quote = await fetchPrice(ticker, c.env.FMP_API_KEY);
  if (!quote) return c.json({ error: 'price unavailable' }, 404);
  return c.json(quote);
});

// ==========================================================================
// API: leaderboard JSON
// ==========================================================================
app.get('/api/leaderboard', async (c) => {
  const rows = await buildLeaderboard(c.env);
  return c.json({ count: rows.length, rows });
});

// ==========================================================================
// Admin endpoints
// ==========================================================================
app.get('/admin/calls', async (c) => {
  if (c.req.query('key') !== 'levin2026') return c.text('Unauthorized', 401);
  const result = await c.env.DB.prepare(`
    SELECT c.*, u.email, u.display_name
    FROM calls c JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC LIMIT 100
  `).all();
  return c.json({ count: result.results?.length ?? 0, calls: result.results });
});

// Brand probe
app.get('/api/brand', (c) => c.json({
  brand: c.get('brand'),
  host: c.req.header('host'),
}));

app.notFound((c) => c.text('Not Found', 404));

// ==========================================================================
// CRON: nightly price refresh
// ==========================================================================
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    try {
      const tickers = await env.DB.prepare(
        'SELECT DISTINCT ticker FROM calls WHERE status = ?'
      ).bind('open').all();
      const list = (tickers.results ?? []) as Array<{ ticker: string }>;
      for (const { ticker } of list) {
        const q = await fetchPrice(ticker, env.FMP_API_KEY);
        if (q) {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO prices (ticker, price, change_1d, updated_at)
            VALUES (?, ?, ?, datetime('now'))
          `).bind(ticker, q.price, q.change_1d ?? null).run();
        }
      }
      console.log(`Refreshed ${list.length} tickers`);
    } catch (err) {
      console.error('Cron refresh error:', err);
    }
  },
};

// ==========================================================================
// HELPERS
// ==========================================================================

async function upsertUser(db: D1Database, email: string, displayName: string, brand: string): Promise<string> {
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (existing) {
    await db.prepare(`UPDATE users SET last_seen_at = datetime('now'), display_name = COALESCE(display_name, ?) WHERE id = ?`)
      .bind(displayName, existing.id).run();
    return existing.id;
  }
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  await db.prepare(`
    INSERT INTO users (id, email, display_name, brand, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).bind(id, email, displayName, brand).run();
  return id;
}

async function buildLeaderboard(env: Env): Promise<LeaderboardRow[]> {
  const result = await env.DB.prepare(`
    SELECT c.id, c.ticker, c.direction, c.rating, c.entry_price, c.entry_date,
           c.price_target, c.thesis, c.company,
           u.display_name, u.email,
           p.price AS current_price
    FROM calls c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN prices p ON p.ticker = c.ticker
    WHERE c.status = 'open'
  `).all<{
    id: string;
    ticker: string;
    direction: 'long' | 'short';
    rating: string;
    entry_price: number;
    entry_date: string;
    price_target: number;
    thesis: string;
    company: string | null;
    display_name: string;
    email: string;
    current_price: number | null;
  }>();

  const raw = result.results ?? [];
  const now = new Date().toISOString();

  const enriched = await Promise.all(raw.map(async (r) => {
    let current = r.current_price;
    if (current == null) {
      const q = await fetchPrice(r.ticker, env.FMP_API_KEY);
      if (q) {
        current = q.price;
        try {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO prices (ticker, price, change_1d, updated_at)
            VALUES (?, ?, ?, datetime('now'))
          `).bind(r.ticker, q.price, q.change_1d ?? null).run();
        } catch (e) {}
      }
    }
    return { ...r, current_price: current };
  }));

  const withPerf = enriched
    .filter(r => r.current_price != null)
    .map(r => ({
      ...r,
      return_pct: calcReturn(r.entry_price, r.current_price!, r.direction),
      days: daysBetween(r.entry_date, now),
    }))
    .sort((a, b) => b.return_pct - a.return_pct);

  return withPerf.map((r, i) => ({
    rank: i + 1,
    user_display: r.display_name || r.email.split('@')[0],
    user_initials: initialsFrom(r.display_name || r.email.split('@')[0]),
    ticker: r.ticker,
    company: r.company,
    direction: r.direction,
    rating: r.rating,
    entry_price: r.entry_price,
    current_price: r.current_price!,
    return_pct: r.return_pct,
    annualized_pct: r.days > 0 ? Math.pow(1 + r.return_pct, 365 / r.days) - 1 : 0,
    price_target: r.price_target,
    days_held: r.days,
    thesis_preview: (r.thesis || '').slice(0, 200),
    call_id: r.id,
  }));
}
