import { Hono } from 'hono';
import puppeteer from '@cloudflare/puppeteer';
import { renderStockPitchLanding } from './brands/stockpitch';
import { renderLevinCapLanding } from './brands/levincap';
import { renderSubmitV2 } from './pages/submit-v2';
import { renderLeaderboard, initialsFrom, daysBetween, type LeaderboardRow } from './pages/leaderboard';
import { renderCallDetail } from './pages/call-detail';
import { renderShareCardHTML } from './pages/share-card';
import { PORTFOLIO } from './portfolio';
import { fetchPrice, fetchPriceStrict, calcReturn } from './lib/prices';
import { generateBrief } from './lib/ai-brief';
import { escapeHtml, isValidEmail, sanitizeTicker, checkRateLimit, newId } from './lib/security';
import {
  ensureTopTenPortfolio,
  rebalanceTopTen,
  computeCurrentNAV,
  snapshotNAV,
  getNavHistory,
  type PortfolioRow,
} from './lib/portfolios';
import { renderPortfolioDetail } from './pages/portfolio-detail';
import { renderPortfolioCard } from './pages/portfolio-card';

interface Env {
  DB: D1Database;
  REQUESTS: KVNamespace;
  AI: any;
  BROWSER: Fetcher;
  ADMIN_KEY?: string;
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
    const rows = await buildLeaderboard(c.env, brand);
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
  `).bind(id).first<CallRow>();

  if (!call) return c.text('Call not found', 404);

  // Fallbacks for nullable fields so the renderer never hits undefined
  const displayName = call.display_name ?? 'Anonymous';
  const thesis = call.thesis ?? '';
  const horizon = call.time_horizon_months ?? 12;

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
      time_horizon_months: horizon,
      thesis,
      display_name: displayName,
    });
    try {
      await c.env.REQUESTS.put(`brief:${id}`, brief, { expirationTtl: 30 * 86400 });
    } catch (e) {
      console.error('brief cache write failed', e);
    }
  }

  let returnPct = 0;
  let currentPrice = call.current_price;
  if (currentPrice == null) {
    const quote = await fetchPrice(call.ticker);
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
    time_horizon_months: horizon,
    thesis,
    catalyst: call.catalyst,
    display_name: displayName,
    brief_markdown: brief,
    days_held: daysHeld,
    return_pct: returnPct,
  }, c.get('brand'), getOrigin(c)));
});

// ==========================================================================
// SHARE CARD — /c/:id/og.png (via Browser Rendering, cached in KV for 24h)
// ==========================================================================
app.get('/c/:id/og.png', async (c) => {
  const id = c.req.param('id');
  const cacheKey = `og:${id}`;
  const origin = getOrigin(c);

  // Serve cached PNG if we have one
  try {
    const cached = await c.env.REQUESTS.get(cacheKey, 'arrayBuffer');
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
          'X-Cache': 'HIT',
        },
      });
    }
  } catch (e) {
    console.error('og cache read failed', e);
  }

  let browser: any = null;
  try {
    browser = await puppeteer.launch(c.env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.goto(`${origin}/c/${id}/card`, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => (document as any).fonts.ready);
    const png = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });

    // Cache for future requests
    try {
      await c.env.REQUESTS.put(cacheKey, png as ArrayBuffer, { expirationTtl: 86400 });
    } catch (e) {
      console.error('og cache write failed', e);
    }

    return new Response(png as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('OG generation error:', err);
    return c.text('Share card unavailable', 500);
  } finally {
    // Always close browser to prevent resource leaks
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
});

// ==========================================================================
// SHARE CARD HTML — rendered as a page so Browser Rendering can screenshot it
// ==========================================================================
app.get('/c/:id/card', async (c) => {
  const id = c.req.param('id');
  const call = await c.env.DB.prepare(`
    SELECT c.ticker, c.direction, c.rating, c.entry_price, c.price_target, c.company,
           u.display_name, p.price AS current_price
    FROM calls c JOIN users u ON u.id = c.user_id
    LEFT JOIN prices p ON p.ticker = c.ticker
    WHERE c.id = ?
  `).bind(id).first<{
    ticker: string;
    direction: 'long' | 'short';
    rating: string;
    entry_price: number;
    price_target: number;
    company: string | null;
    display_name: string | null;
    current_price: number | null;
  }>();
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
    display_name: call.display_name ?? 'Anonymous',
    brand: c.get('brand'),
  }));
});

// ==========================================================================
// API: submit a call
// Security hardening vs v0.1.0:
//   - server-locks entry_price (ignores client value)
//   - rejects tickers without a real price quote (no mock fallback)
//   - escapes user strings at render time (display_name, thesis)
//   - rate limits per IP: 5 submissions per hour
//   - rate limits per email: 3 submissions per hour
//   - validates direction + rating enum values
// ==========================================================================
app.post('/api/calls', async (c) => {
  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    // Required fields + enum validation
    const ticker = sanitizeTicker(body.ticker);
    if (!ticker) return c.json({ error: 'Valid ticker required' }, 400);

    if (!isValidEmail(body.email)) return c.json({ error: 'Valid email required' }, 400);
    const email = String(body.email).trim().toLowerCase();

    const displayName = String(body.display_name || '').trim().slice(0, 80);
    if (!displayName) return c.json({ error: 'Display name required' }, 400);

    const direction = String(body.direction || '').toLowerCase();
    if (direction !== 'long' && direction !== 'short') {
      return c.json({ error: 'Direction must be long or short' }, 400);
    }

    const rating = String(body.rating || '').toLowerCase();
    const RATINGS = new Set(['buy', 'overweight', 'hold', 'underweight', 'sell']);
    if (!RATINGS.has(rating)) return c.json({ error: 'Invalid rating' }, 400);

    const priceTarget = Number(body.price_target);
    if (!Number.isFinite(priceTarget) || priceTarget <= 0 || priceTarget > 1_000_000) {
      return c.json({ error: 'Price target must be a positive number' }, 400);
    }

    const timeHorizon = Number(body.time_horizon_months) || 12;
    const ALLOWED_HORIZONS = new Set([3, 6, 12, 18, 24, 36]);
    if (!ALLOWED_HORIZONS.has(timeHorizon)) {
      return c.json({ error: 'Invalid time horizon' }, 400);
    }

    const thesis = String(body.thesis || '').trim();
    if (thesis.length < 100 || thesis.length > 5000) {
      return c.json({ error: 'Thesis must be 100–5000 characters' }, 400);
    }

    const catalyst = body.catalyst != null ? String(body.catalyst).trim().slice(0, 120) : null;

    // Rate limits — fail-open on KV error so legitimate users aren't locked out
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const ipLimit = await checkRateLimit(c.env.REQUESTS, `ip:${ip}`, 5, 3600);
    if (!ipLimit.allowed) {
      return c.json({ error: 'Too many submissions from this network. Try again in an hour.' }, 429);
    }
    const emailLimit = await checkRateLimit(c.env.REQUESTS, `email:${email}`, 3, 3600);
    if (!emailLimit.allowed) {
      return c.json({ error: 'Too many submissions from this email. Try again in an hour.' }, 429);
    }

    // Strict price lookup — reject tickers we can't confidently quote.
    // Allows demo-data fallback in preview env so deployed preview still works
    // without an external price source.
    const isPreview = c.env.ENVIRONMENT === 'preview';
    const quote = await fetchPriceStrict(ticker, { allowDemoFallback: isPreview });
    if (!quote) {
      return c.json({ error: `Could not price ${ticker}. Check the symbol and try again.` }, 400);
    }

    const brand = c.get('brand');
    const userId = await upsertUser(c.env.DB, email, displayName, brand);

    // SERVER-SIDE ENTRY PRICE LOCK — we ignore body.entry_price entirely
    const entryPrice = quote.price;
    const callId = newId();
    const entryDate = new Date().toISOString();

    await c.env.DB.prepare(`
      INSERT INTO calls (
        id, user_id, ticker, company, direction, rating, price_target, entry_price, entry_date,
        time_horizon_months, thesis, catalyst, brand, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      callId, userId, ticker, quote.company, direction, rating,
      priceTarget, entryPrice, entryDate, timeHorizon, thesis, catalyst, brand
    ).run();

    // Cache the price we just used so leaderboard reads hit D1 first
    try {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO prices (ticker, price, change_1d, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `).bind(ticker, quote.price, quote.change_1d ?? null).run();
    } catch (e) {}

    // Fire-and-forget AI brief generation
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const brief = await generateBrief(c.env.AI, {
            ticker,
            company: quote.company,
            direction: direction as 'long' | 'short',
            rating,
            entry_price: entryPrice,
            price_target: priceTarget,
            time_horizon_months: timeHorizon,
            thesis,
            display_name: displayName,
          });
          await c.env.REQUESTS.put(`brief:${callId}`, brief, { expirationTtl: 30 * 86400 });
        } catch (err) {
          console.error('Background brief generation failed:', err);
        }
      })()
    );

    return c.json({
      success: true,
      id: callId,
      entry_price: entryPrice,
      company: quote.company,
    });
  } catch (err) {
    console.error('Call submit error:', err);
    return c.json({ error: 'Failed to submit call' }, 500);
  }
});

// ==========================================================================
// API: price lookup (used by submit form)
// ==========================================================================
app.get('/api/price', async (c) => {
  const raw = c.req.query('ticker');
  const ticker = sanitizeTicker(raw || '');
  if (!ticker) return c.json({ error: 'ticker required' }, 400);
  const quote = await fetchPrice(ticker);
  if (!quote) return c.json({ error: 'price unavailable' }, 404);
  return c.json(quote);
});

// ==========================================================================
// API: leaderboard JSON
// ==========================================================================
app.get('/api/leaderboard', async (c) => {
  const rows = await buildLeaderboard(c.env, c.get('brand'));
  return c.json({ count: rows.length, rows });
});

// ==========================================================================
// Admin — now requires ADMIN_KEY env secret, not hardcoded
// ==========================================================================
app.get('/admin/calls', async (c) => {
  const configured = c.env.ADMIN_KEY;
  const supplied = c.req.header('x-admin-key') || c.req.query('key');
  if (!configured || !supplied || supplied !== configured) {
    return c.text('Unauthorized', 401);
  }
  const result = await c.env.DB.prepare(`
    SELECT c.*, u.email, u.display_name
    FROM calls c JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC LIMIT 100
  `).all();
  return c.json({ count: result.results?.length ?? 0, calls: result.results });
});

// ==========================================================================
// PORTFOLIO: detail page — /p/:slug
// ==========================================================================
app.get('/p/:slug', async (c) => {
  const slug = c.req.param('slug').toLowerCase().trim();
  const portfolio = await c.env.DB
    .prepare('SELECT * FROM portfolios WHERE slug = ?')
    .bind(slug)
    .first<PortfolioRow>();
  if (!portfolio) return c.text('Portfolio not found', 404);

  try {
    const { nav, positions_with_perf, total_return_pct } = await computeCurrentNAV(c.env.DB, portfolio.id);
    const nav_history = await getNavHistory(c.env.DB, portfolio.id, 90);
    return c.html(renderPortfolioDetail({
      portfolio,
      positions: positions_with_perf,
      nav,
      total_return_pct,
      nav_history,
      brand: c.get('brand'),
      origin: getOrigin(c),
    }));
  } catch (err) {
    console.error('Portfolio detail error:', err);
    return c.text('Error loading portfolio', 500);
  }
});

// ==========================================================================
// PORTFOLIO: share card HTML (for Browser Rendering to screenshot)
// ==========================================================================
app.get('/p/:slug/card', async (c) => {
  const slug = c.req.param('slug').toLowerCase().trim();
  const portfolio = await c.env.DB
    .prepare('SELECT * FROM portfolios WHERE slug = ?')
    .bind(slug)
    .first<PortfolioRow>();
  if (!portfolio) return c.text('Not found', 404);

  const { nav, positions_with_perf, total_return_pct } = await computeCurrentNAV(c.env.DB, portfolio.id);
  const nav_history = await getNavHistory(c.env.DB, portfolio.id, 30);
  return c.html(renderPortfolioCard({
    portfolio,
    positions: positions_with_perf,
    nav,
    total_return_pct,
    nav_history,
    brand: c.get('brand'),
  }));
});

// ==========================================================================
// PORTFOLIO: OG PNG (cached 24h in KV, generated via Browser Rendering)
// ==========================================================================
app.get('/p/:slug/og.png', async (c) => {
  const slug = c.req.param('slug').toLowerCase().trim();
  const cacheKey = `og:p:${slug}`;
  const origin = getOrigin(c);

  try {
    const cached = await c.env.REQUESTS.get(cacheKey, 'arrayBuffer');
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
          'X-Cache': 'HIT',
        },
      });
    }
  } catch (e) {
    console.error('portfolio og cache read failed', e);
  }

  let browser: any = null;
  try {
    browser = await puppeteer.launch(c.env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630 });
    await page.goto(`${origin}/p/${slug}/card`, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => (document as any).fonts.ready);
    const png = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    try {
      await c.env.REQUESTS.put(cacheKey, png as ArrayBuffer, { expirationTtl: 86400 });
    } catch (e) {}
    return new Response(png as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('Portfolio OG generation error:', err);
    return c.text('Share card unavailable', 500);
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
});

// ==========================================================================
// PORTFOLIO: JSON API (read-only)
// ==========================================================================
app.get('/api/portfolios/:slug', async (c) => {
  const slug = c.req.param('slug').toLowerCase().trim();
  const portfolio = await c.env.DB
    .prepare('SELECT * FROM portfolios WHERE slug = ?')
    .bind(slug)
    .first<PortfolioRow>();
  if (!portfolio) return c.json({ error: 'not found' }, 404);
  const { nav, positions_with_perf, total_return_pct } = await computeCurrentNAV(c.env.DB, portfolio.id);
  const nav_history = await getNavHistory(c.env.DB, portfolio.id, 90);
  return c.json({
    portfolio,
    nav,
    total_return_pct,
    positions: positions_with_perf,
    nav_history,
  });
});

// ==========================================================================
// ADMIN: manually trigger portfolio rebalance (for setup / debugging)
// ==========================================================================
app.post('/admin/portfolios/:slug/rebalance', async (c) => {
  const configured = c.env.ADMIN_KEY;
  const supplied = c.req.header('x-admin-key') || c.req.query('key');
  if (!configured || !supplied || supplied !== configured) {
    return c.text('Unauthorized', 401);
  }
  const slug = c.req.param('slug').toLowerCase().trim();

  // Auto-create the top10 portfolio on first rebalance if it doesn't exist
  if (slug === 'top10') {
    await ensureTopTenPortfolio(c.env.DB);
  }

  const portfolio = await c.env.DB
    .prepare('SELECT * FROM portfolios WHERE slug = ?')
    .bind(slug)
    .first<PortfolioRow>();
  if (!portfolio) return c.json({ error: 'portfolio not found' }, 404);

  const result = await rebalanceTopTen(c.env.DB, portfolio.id);
  const nav = await snapshotNAV(c.env.DB, portfolio.id);
  // Invalidate OG cache
  try { await c.env.REQUESTS.delete(`og:p:${slug}`); } catch (e) {}
  return c.json({ success: true, rebalance: result, nav });
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
    // Step 1: refresh all prices
    try {
      const tickers = await env.DB.prepare(
        'SELECT DISTINCT ticker FROM calls WHERE status = ?'
      ).bind('open').all<{ ticker: string }>();
      const list = tickers.results ?? [];
      for (const { ticker } of list) {
        const q = await fetchPrice(ticker);
        if (q) {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO prices (ticker, price, change_1d, updated_at)
            VALUES (?, ?, ?, datetime('now'))
          `).bind(ticker, q.price, q.change_1d ?? null).run();
        }
      }
      console.log(`Refreshed ${list.length} tickers`);
    } catch (err) {
      console.error('Cron price refresh error:', err);
    }

    // Step 2: rebalance auto portfolios + snapshot NAV
    try {
      const portfolioId = await ensureTopTenPortfolio(env.DB);
      const result = await rebalanceTopTen(env.DB, portfolioId);
      const nav = await snapshotNAV(env.DB, portfolioId);
      console.log(`Rebalance top10: opened=${result.opened} closed=${result.closed} held=${result.held} nav=$${nav.toFixed(2)}`);
    } catch (err) {
      console.error('Cron rebalance error:', err);
    }

    // Invalidate portfolio OG cache after NAV updates
    try {
      // KV doesn't have a "delete by prefix" — use a list + delete in parallel
      // Only expire the few known portfolio slugs; cheap enough to hit them explicitly.
      const slugs = ['top10'];
      await Promise.all(slugs.map(s => env.REQUESTS.delete(`og:p:${s}`)));
    } catch (e) {}
  },
};

// ==========================================================================
// HELPERS
// ==========================================================================

interface CallRow {
  id: string;
  ticker: string;
  direction: 'long' | 'short';
  rating: string;
  entry_price: number;
  entry_date: string;
  price_target: number;
  time_horizon_months: number | null;
  thesis: string | null;
  catalyst: string | null;
  company: string | null;
  display_name: string | null;
  current_price: number | null;
}

/**
 * Upsert user — race-safe via INSERT OR IGNORE + SELECT pattern. If two
 * concurrent requests insert the same email, one wins, the other sees it
 * via the follow-up SELECT. No 500s, no duplicate rows (email UNIQUE).
 */
async function upsertUser(
  db: D1Database,
  email: string,
  displayName: string,
  brand: string
): Promise<string> {
  const newUserId = newId();
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO users (id, email, display_name, brand, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(newUserId, email, displayName, brand).run();
  } catch (e) {
    // INSERT OR IGNORE should never throw on conflict; log anything else
    console.error('user insert failed', e);
  }

  // Read back — works whether we inserted or collided
  const row = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (!row) throw new Error('user upsert race: no row found after insert');

  // Touch last_seen_at + fill missing display_name
  try {
    await db.prepare(`
      UPDATE users
      SET last_seen_at = datetime('now'),
          display_name = COALESCE(display_name, ?)
      WHERE id = ?
    `).bind(displayName, row.id).run();
  } catch (e) {}

  return row.id;
}

/**
 * Build the leaderboard with deduplicated ticker price lookups.
 * Fetch each unique ticker at most once, write prices through in a single batch.
 */
async function buildLeaderboard(env: Env, brand: Brand): Promise<LeaderboardRow[]> {
  // Data is NOT brand-isolated for MVP — leaderboard is shared across brands
  // so both variants see the same calls. Brand-scoped leaderboards would fragment
  // the network effect before it has a chance to form.
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
    thesis: string | null;
    company: string | null;
    display_name: string | null;
    email: string;
    current_price: number | null;
  }>();

  const raw = result.results ?? [];

  // Collect tickers that need a live fetch (exactly once each)
  const tickersNeedingPrice = Array.from(new Set(
    raw.filter(r => r.current_price == null).map(r => r.ticker)
  ));

  const fetchedPrices = new Map<string, number>();
  if (tickersNeedingPrice.length > 0) {
    const quotes = await Promise.all(tickersNeedingPrice.map(t => fetchPrice(t)));
    for (let i = 0; i < tickersNeedingPrice.length; i++) {
      const q = quotes[i];
      if (q) {
        fetchedPrices.set(tickersNeedingPrice[i], q.price);
      }
    }

    // Write through to prices table in parallel (cheaper than per-row)
    await Promise.all(
      tickersNeedingPrice.map(async (t, i) => {
        const q = quotes[i];
        if (!q) return;
        try {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO prices (ticker, price, change_1d, updated_at)
            VALUES (?, ?, ?, datetime('now'))
          `).bind(t, q.price, q.change_1d ?? null).run();
        } catch (e) {}
      })
    );
  }

  const now = new Date().toISOString();
  const withPerf = raw
    .map(r => {
      const currentPrice = r.current_price ?? fetchedPrices.get(r.ticker) ?? null;
      if (currentPrice == null) return null;
      return {
        ...r,
        current_price: currentPrice,
        return_pct: calcReturn(r.entry_price, currentPrice, r.direction),
        days: daysBetween(r.entry_date, now),
      };
    })
    .filter((r): r is Exclude<typeof r, null> => r !== null)
    .sort((a, b) => b.return_pct - a.return_pct);

  return withPerf.map((r, i) => {
    // Escape everything that flows into HTML
    const safeName = escapeHtml(r.display_name || r.email.split('@')[0]);
    const safeTicker = escapeHtml(r.ticker);
    const safeCompany = r.company ? escapeHtml(r.company) : null;
    return {
      rank: i + 1,
      user_display: safeName,
      user_initials: initialsFrom(r.display_name || r.email.split('@')[0]),
      ticker: safeTicker,
      company: safeCompany,
      direction: r.direction,
      rating: r.rating,
      entry_price: r.entry_price,
      current_price: r.current_price,
      return_pct: r.return_pct,
      annualized_pct: r.days > 0 ? Math.pow(1 + r.return_pct, 365 / r.days) - 1 : 0,
      price_target: r.price_target,
      days_held: r.days,
      thesis_preview: escapeHtml((r.thesis || '').slice(0, 200)),
      call_id: r.id,
    };
  });
}
