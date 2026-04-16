import { Hono } from 'hono';
import { routeAgentRequest } from 'agents';
export { ResearchAgent } from './agents/research-agent';
export { WorkflowAgent } from './agents/workflow-agent';
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
import { renderAuthRequest, renderAuthVerifyError } from './pages/auth-pages';
import { renderDashboard } from './pages/dashboard';
import {
  createMagicToken,
  verifyMagicToken,
  signSession,
  getUserFromRequest,
  sessionSetCookie,
  sessionClearCookie,
  type SessionUser,
} from './lib/auth';
import {
  sendEmail,
  magicLinkEmail,
  welcomeEmail,
  briefReadyEmail,
} from './lib/email';
import {
  createCheckoutSession,
  verifyStripeSignature,
  tierFromEvent,
  priceForTier,
  type Tier,
} from './lib/stripe';
import { renderResearchDesk } from './pages/research-desk';
import { renderWorkflowRun, renderRunDetail } from './pages/workflow-run';
import { WORKFLOWS, isValidWorkflow, type WorkflowSlug } from './lib/workflow-config';

interface Env {
  DB: D1Database;
  REQUESTS: KVNamespace;
  AI: any;
  BROWSER: Fetcher;
  ResearchAgent: DurableObjectNamespace;
  WorkflowAgent: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  ADMIN_KEY?: string;
  FMP_API_KEY?: string;
  SESSION_SECRET?: string;
  // MailChannels email
  MAILCHANNELS_API_KEY?: string;
  MAIL_FROM_ADDRESS?: string;
  MAIL_FROM_NAME?: string;
  MAILCHANNELS_DKIM_DOMAIN?: string;
  MAILCHANNELS_DKIM_SELECTOR?: string;
  MAILCHANNELS_DKIM_PRIVATE_KEY?: string;
  // Stripe billing (Phase 2c)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_WHITEGLOVE?: string;
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

const app = new Hono<{ Bindings: Env; Variables: { brand: Brand; user: SessionUser | null } }>();

app.use('*', async (c, next) => {
  const host = c.req.header('host') || '';
  // Preview override — ?brand=levincap|stockpitch — so we can A/B test both
  // variants on the same workers.dev subdomain before custom domains are live.
  const override = c.req.query('brand');
  if (override === 'levincap' || override === 'stockpitch') {
    c.set('brand', override);
  } else {
    c.set('brand', detectBrand(host));
  }
  const secret = c.env.SESSION_SECRET;
  if (secret) {
    try {
      const user = await getUserFromRequest(c.req.raw.headers, secret);
      c.set('user', user);
    } catch {
      c.set('user', null);
    }
  } else {
    c.set('user', null);
  }
  await next();
});

// Path-mount rewriter lives at the worker entry (`mountedFetch` near the
// end of this file) using Cloudflare's HTMLRewriter. No extra middleware.

// ==========================================================================
// LANDING
// ==========================================================================
app.get('/', async (c) => {
  const brand = c.get('brand');
  let top: LeaderboardRow[] = [];
  try {
    const rows = await buildLeaderboard(c.env, brand);
    top = rows.slice(0, 5);
  } catch (err) {
    console.error('Landing leaderboard fetch failed:', err);
  }
  const html = brand === 'levincap'
    ? renderLevinCapLanding(PORTFOLIO, top)
    : renderStockPitchLanding(PORTFOLIO, top);
  return c.html(html);
});

// ==========================================================================
// RESEARCH — legacy single-ticker research page (now redirects to workflow)
// Kept for backward compat: /research?ticker=AAPL → /research/coverage?ticker=AAPL
// ==========================================================================
app.get('/research-single', async (c) => {
  const ticker = (c.req.query('ticker') || '').toUpperCase().replace(/[^A-Z.]/g, '').slice(0, 8);
  if (!ticker) return c.redirect('/');
  const { renderResearchPage } = await import('./pages/research');
  return c.html(renderResearchPage(c.get('brand'), ticker));
});

// ==========================================================================
// AGENT — invoke the Think-based Research Agent for a ticker
// ==========================================================================
app.post('/api/agent/research', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const ticker = sanitizeTicker(String(body.ticker || ''));
  if (!ticker) return c.json({ error: 'ticker required' }, 400);

  const doId = c.env.ResearchAgent.idFromName(ticker);
  const stub = c.env.ResearchAgent.get(doId);
  const doResp = await stub.fetch('http://agent/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker }),
  });
  const result = await doResp.json();
  return c.json(result as any, doResp.ok ? 200 : 500);
});

// ==========================================================================
// RESEARCH DESK — AI workflow platform
// ==========================================================================

// Helper: auth redirect that works from both /stock-pitch and /research mounts
function authRedirect(c: any, next: string) {
  const host = c.req.header('host') || '';
  // On levincap.com, auth is under the /stock-pitch mount
  const prefix = host.includes('levincap.com') ? '/stock-pitch' : '';
  return c.redirect(`${prefix}/auth/signin?next=${encodeURIComponent(next)}`);
}

// Dashboard — accessible without auth (shows empty recent list), auth required to run workflows
app.get('/research', async (c) => {
  const user = c.get('user');
  let recentRuns: any[] = [];
  if (user) {
    const { results } = await c.env.DB.prepare(
      `SELECT id, workflow, ticker, output_summary, status, created_at, duration_ms
       FROM workflow_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
    ).bind(user.id).all();
    recentRuns = results as any[] || [];
  }
  const mountPrefix = '';  // path-mount rewriter handles this
  return c.html(renderResearchDesk(recentRuns, mountPrefix));
});

// History page
app.get('/research/history', async (c) => {
  const user = c.get('user');
  if (!user) return authRedirect(c, '/research/history');
  const { results } = await c.env.DB.prepare(
    `SELECT id, workflow, ticker, output_summary, status, created_at, duration_ms
     FROM workflow_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
  ).bind(user.id).all();
  const mountPrefix = '';
  return c.html(renderResearchDesk(results as any[] || [], mountPrefix));
});

// View a completed run
app.get('/research/run/:id', async (c) => {
  const user = c.get('user');
  if (!user) return authRedirect(c, '/research');
  const runId = c.req.param('id');
  const run = await c.env.DB.prepare(
    `SELECT * FROM workflow_runs WHERE id = ? AND user_id = ?`
  ).bind(runId, user.id).first();
  if (!run) return c.text('Run not found', 404);
  return c.html(renderRunDetail(run, ''));
});

// Workflow page — viewable without auth, Run button requires auth via API
app.get('/research/:workflow', (c) => {
  const slug = c.req.param('workflow');
  if (!isValidWorkflow(slug)) return c.text('Unknown workflow', 404);
  const ticker = c.req.query('ticker')?.toUpperCase().replace(/[^A-Z.]/g, '') || undefined;
  const config = WORKFLOWS[slug as WorkflowSlug];
  return c.html(renderWorkflowRun({ workflow: config, ticker, mountPrefix: '' }));
});

// API: Create a workflow run (returns runId)
app.post('/api/research/run', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({} as any));
  const { workflow, ticker, context } = body;
  if (!workflow || !isValidWorkflow(workflow)) return c.json({ error: 'Invalid workflow' }, 400);
  const config = WORKFLOWS[workflow as WorkflowSlug];
  if (config.requiresTicker && !ticker) return c.json({ error: 'Ticker required' }, 400);
  const safeTicker = ticker ? String(ticker).toUpperCase().replace(/[^A-Z.]/g, '').slice(0, 10) : null;
  const runId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  await c.env.DB.prepare(
    `INSERT INTO workflow_runs (id, user_id, workflow, ticker, status, input_params) VALUES (?, ?, ?, ?, 'running', ?)`
  ).bind(runId, user.id, workflow, safeTicker, JSON.stringify({ ticker: safeTicker, context: context || null })).run();
  return c.json({ ok: true, runId });
});

// API: Stream a workflow run via SSE (connects to WorkflowAgent DO)
app.post('/api/research/run/:id/stream', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const runId = c.req.param('id');
  const body = await c.req.json().catch(() => ({} as any));
  const { workflow, ticker, context } = body;
  if (!workflow || !isValidWorkflow(workflow)) return c.json({ error: 'Invalid workflow' }, 400);
  const safeTicker = ticker ? String(ticker).toUpperCase().replace(/[^A-Z.]/g, '').slice(0, 10) : '';

  // Name the DO by workflow:ticker:user for per-user isolation
  const doName = `${workflow}:${safeTicker || 'all'}:${user.id}:${runId}`;
  const doId = c.env.WorkflowAgent.idFromName(doName);
  const stub = c.env.WorkflowAgent.get(doId);

  const doResp = await stub.fetch('http://agent/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow, ticker: safeTicker || undefined, context, userId: user.id, runId }),
  });

  // Pass through the SSE stream
  return new Response(doResp.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// API: Poll run status
app.get('/api/research/run/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const run = await c.env.DB.prepare(
    `SELECT id, workflow, ticker, status, output_summary, output_json, tool_calls, tokens_used, duration_ms, error_message, created_at, completed_at
     FROM workflow_runs WHERE id = ? AND user_id = ?`
  ).bind(c.req.param('id'), user.id).first();
  if (!run) return c.json({ error: 'Not found' }, 404);
  return c.json(run);
});

// ==========================================================================
// SUBMIT — legacy progressive step-based flow (kept for backward compat)
// ==========================================================================
app.get('/submit', (c) => {
  const ticker = (c.req.query('ticker') || '').toUpperCase().replace(/[^A-Z.]/g, '').slice(0, 8);
  return c.html(renderSubmitV2(c.get('brand'), ticker || undefined));
});

// ==========================================================================
// RESEARCH LIBRARY — replaces the old leaderboard
// ==========================================================================
app.get('/library', async (c) => {
  const brand = c.get('brand');
  const { renderLibrary } = await import('./pages/library');
  type PR = import('./pages/library').PortalRow;
  type BS = import('./pages/library').BookSummary;

  const portals = await c.env.DB.prepare(
    'SELECT ticker, company, sector, direction, rating, price_at_generation, price_target, upside_pct, confidence_index, summary, generated_at FROM portals ORDER BY confidence_index DESC'
  ).all<PR>();

  const longPositions = await c.env.DB.prepare(
    'SELECT ticker, weight_pct, confidence_index, price_target FROM book_positions WHERE book = ? ORDER BY weight_pct DESC'
  ).bind('long').all<{ ticker: string; weight_pct: number; confidence_index: number; price_target: number | null }>();

  const shortPositions = await c.env.DB.prepare(
    'SELECT ticker, weight_pct, confidence_index, price_target FROM book_positions WHERE book = ? ORDER BY weight_pct DESC'
  ).bind('short').all<{ ticker: string; weight_pct: number; confidence_index: number; price_target: number | null }>();

  const longBook: BS = { book: 'long', positions: longPositions.results ?? [] };
  const shortBook: BS = { book: 'short', positions: shortPositions.results ?? [] };

  return c.html(renderLibrary(brand, portals.results ?? [], longBook, shortBook));
});

// Legacy leaderboard — redirect to library
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
          // Notify user that their brief is ready
          try {
            const origin = getOrigin(c);
            const { subject, html } = briefReadyEmail(origin, ticker, callId, direction);
            await sendEmail(c.env, { to: email, subject, html });
          } catch (e) {
            console.error('brief-ready email failed', e);
          }
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

    // Check follow state if signed in
    const user = c.get('user');
    let is_following = false;
    if (user) {
      const row = await c.env.DB
        .prepare('SELECT 1 AS found FROM portfolio_followers WHERE user_id = ? AND portfolio_id = ?')
        .bind(user.id, portfolio.id)
        .first<{ found: number }>();
      is_following = !!row;
    }

    return c.html(renderPortfolioDetail({
      portfolio,
      positions: positions_with_perf,
      nav,
      total_return_pct,
      nav_history,
      brand: c.get('brand'),
      origin: getOrigin(c),
      is_signed_in: !!user,
      is_following,
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
// ADMIN: reseed leaderboard — wipes calls/users and re-runs seed for demos
// Protected by ADMIN_KEY. Use during live team demo to reset state quickly.
// ==========================================================================
app.post('/admin/reseed', async (c) => {
  const configured = c.env.ADMIN_KEY;
  const supplied = c.req.header('x-admin-key') || c.req.query('key');
  if (!configured || !supplied || supplied !== configured) {
    return c.text('Unauthorized', 401);
  }

  try {
    // Wipe in dependency order — positions/followers/nav before calls, calls before users
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM portfolio_positions'),
      c.env.DB.prepare('DELETE FROM portfolio_followers'),
      c.env.DB.prepare('DELETE FROM portfolio_nav_history'),
      c.env.DB.prepare('DELETE FROM auth_tokens'),
      c.env.DB.prepare('DELETE FROM calls'),
      c.env.DB.prepare('DELETE FROM users'),
      c.env.DB.prepare('DELETE FROM prices'),
    ]);

    // Invalidate caches
    try {
      await c.env.REQUESTS.delete('og:p:top10');
    } catch (e) {}

    return c.json({
      ok: true,
      message: 'Leaderboard wiped. Re-seed via: wrangler d1 execute stock-pitch-db --remote --file=src/db/seed.sql',
    });
  } catch (err) {
    console.error('reseed failed', err);
    return c.json({ ok: false, error: String(err) }, 500);
  }
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

// ==========================================================================
// AUTH — magic link sign-in
// ==========================================================================
app.get('/auth/signin', (c) => {
  const email = c.req.query('email') || '';
  return c.html(renderAuthRequest(c.get('brand'), email));
});

app.post('/auth/request', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({} as any));
    const email = String(body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) return c.json({ ok: false, error: 'Valid email required' }, 400);

    // Rate limit by IP and email — magic links are abusable for spam
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const ipLimit = await checkRateLimit(c.env.REQUESTS, `auth:ip:${ip}`, 10, 3600);
    if (!ipLimit.allowed) {
      return c.json({ ok: false, error: 'Too many requests. Try again in an hour.' }, 429);
    }
    const emailLimit = await checkRateLimit(c.env.REQUESTS, `auth:email:${email}`, 5, 3600);
    if (!emailLimit.allowed) {
      return c.json({ ok: false, error: 'Too many links sent. Check your inbox or wait an hour.' }, 429);
    }

    const token = await createMagicToken(c.env.DB, email);
    const origin = getOrigin(c);
    const { subject, html, text } = magicLinkEmail(origin, token);
    const sendResult = await sendEmail(c.env, { to: email, subject, html, text });

    // Dev mode: no RESEND_API_KEY — surface the link so we can copy-paste
    if (sendResult.skipped) {
      console.log(`[auth] magic link (dev): ${origin}/auth/verify/${token}`);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error('auth/request failed', err);
    return c.json({ ok: false, error: 'Could not send link. Try again.' }, 500);
  }
});

app.get('/auth/verify/:token', async (c) => {
  const brand = c.get('brand');
  const secret = c.env.SESSION_SECRET;
  if (!secret) {
    return c.html(renderAuthVerifyError(brand, 'Auth is not configured on this server.'));
  }
  const token = c.req.param('token');
  const result = await verifyMagicToken(c.env.DB, token, brand);
  if (!result) {
    return c.html(renderAuthVerifyError(brand, 'This link is invalid, expired, or already used.'));
  }

  // Check if this was their first sign-in — send welcome email if so
  const userRow = await c.env.DB
    .prepare('SELECT display_name, last_seen_at FROM users WHERE id = ?')
    .bind(result.user_id)
    .first<{ display_name: string | null; last_seen_at: string | null }>();

  // Heuristic: if last_seen_at is null/unset at verify, treat as first-time
  // (verify consumes the token and sets last_seen_at afterward)
  const isFirstSignIn = !userRow?.last_seen_at;
  if (isFirstSignIn) {
    c.executionCtx.waitUntil((async () => {
      try {
        const origin = getOrigin(c);
        const { subject, html } = welcomeEmail(origin, userRow?.display_name || null);
        await sendEmail(c.env, { to: result.email, subject, html });
      } catch (e) {
        console.error('welcome email failed', e);
      }
    })());
  }

  const cookie = await signSession(result.user_id, result.email, secret);
  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': sessionSetCookie(cookie),
      Location: '/app',
    },
  });
});

app.post('/auth/logout', (c) => {
  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': sessionClearCookie(),
      Location: '/',
    },
  });
});

// ==========================================================================
// DASHBOARD — /app (requires auth)
// ==========================================================================
app.get('/app', async (c) => {
  const user = c.get('user');
  if (!user) return c.redirect('/auth/signin');

  // Fetch user profile for display_name
  const profile = await c.env.DB
    .prepare('SELECT id, email, display_name FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ id: string; email: string; display_name: string | null }>();
  if (!profile) return c.redirect('/auth/signin');

  // Fetch user's calls + current prices
  const callsRaw = await c.env.DB.prepare(`
    SELECT c.id, c.ticker, c.company, c.direction, c.rating, c.entry_price, c.entry_date,
           c.price_target, c.thesis,
           p.price AS current_price
    FROM calls c
    LEFT JOIN prices p ON p.ticker = c.ticker
    WHERE c.user_id = ? AND c.status = 'open'
    ORDER BY c.created_at DESC
  `).bind(user.id).all<{
    id: string; ticker: string; company: string | null; direction: 'long' | 'short';
    rating: string; entry_price: number; entry_date: string; price_target: number;
    thesis: string | null; current_price: number | null;
  }>();

  const now = new Date().toISOString();
  const calls = (callsRaw.results ?? []).map(r => ({
    id: r.id,
    ticker: r.ticker,
    company: r.company,
    direction: r.direction,
    rating: r.rating,
    entry_price: r.entry_price,
    current_price: r.current_price,
    price_target: r.price_target,
    return_pct: r.current_price != null ? calcReturn(r.entry_price, r.current_price, r.direction) : 0,
    days_held: daysBetween(r.entry_date, now),
    entry_date: r.entry_date,
    thesis: r.thesis ?? '',
  }));

  // Fetch portfolios the user follows
  const followedRaw = await c.env.DB.prepare(`
    SELECT p.slug, p.name, p.description, p.current_value, p.irr_since_inception,
           pf.followed_at
    FROM portfolio_followers pf
    JOIN portfolios p ON p.id = pf.portfolio_id
    WHERE pf.user_id = ?
    ORDER BY pf.followed_at DESC
  `).bind(user.id).all<{
    slug: string; name: string; description: string | null;
    current_value: number | null; irr_since_inception: number | null;
    followed_at: string;
  }>();
  const followed = followedRaw.results ?? [];

  return c.html(renderDashboard({
    user: profile,
    calls,
    followed,
    brand: c.get('brand'),
  }));
});

// ==========================================================================
// FOLLOW API — /api/follow/:slug
// ==========================================================================
app.post('/api/follow/:slug', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not signed in' }, 401);
  const slug = c.req.param('slug').toLowerCase().trim();
  const portfolio = await c.env.DB
    .prepare('SELECT id FROM portfolios WHERE slug = ?')
    .bind(slug)
    .first<{ id: string }>();
  if (!portfolio) return c.json({ error: 'Portfolio not found' }, 404);

  try {
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO portfolio_followers (user_id, portfolio_id, followed_at)
      VALUES (?, ?, datetime('now'))
    `).bind(user.id, portfolio.id).run();
  } catch (e) {
    console.error('follow insert failed', e);
    return c.json({ error: 'Could not follow' }, 500);
  }
  return c.json({ ok: true, following: true });
});

app.delete('/api/follow/:slug', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not signed in' }, 401);
  const slug = c.req.param('slug').toLowerCase().trim();
  const portfolio = await c.env.DB
    .prepare('SELECT id FROM portfolios WHERE slug = ?')
    .bind(slug)
    .first<{ id: string }>();
  if (!portfolio) return c.json({ error: 'Portfolio not found' }, 404);

  await c.env.DB.prepare(`
    DELETE FROM portfolio_followers WHERE user_id = ? AND portfolio_id = ?
  `).bind(user.id, portfolio.id).run();
  return c.json({ ok: true, following: false });
});

// ==========================================================================
// STRIPE — Phase 2c billing (pro + white-glove subscriptions)
// ==========================================================================
app.post('/api/checkout', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Not signed in' }, 401);

  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
  const tier = body.tier as Tier;
  if (tier !== 'pro' && tier !== 'white_glove') {
    return c.json({ error: 'Invalid tier' }, 400);
  }
  const priceId = priceForTier(c.env, tier);
  if (!priceId) return c.json({ error: 'Tier not configured on server' }, 500);

  const origin = getOrigin(c);
  const result = await createCheckoutSession(c.env, {
    priceId,
    userId: user.id,
    email: user.email,
    successUrl: `${origin}/billing/success`,
    cancelUrl: `${origin}/app`,
  });

  if (!result.ok) return c.json({ error: result.error }, 500);
  return c.json({ ok: true, url: result.url });
});

app.get('/billing/success', (c) => {
  // Stripe has already done its job via webhook; this is just a landing page.
  // Redirect to dashboard — the tier change should be visible there.
  return c.redirect('/app?upgraded=1');
});

app.post('/stripe/webhook', async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: 'Webhook secret not configured' }, 500);

  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'Missing stripe-signature' }, 400);

  const payload = await c.req.text();
  const valid = await verifyStripeSignature(payload, sig, secret);
  if (!valid) return c.json({ error: 'Invalid signature' }, 400);

  let event: any;
  try { event = JSON.parse(payload); } catch { return c.json({ error: 'Invalid payload' }, 400); }

  const tierUpdate = tierFromEvent(event, c.env);
  if (!tierUpdate) {
    // Event we don't care about — ack so Stripe stops retrying
    return c.json({ ok: true, ignored: event.type });
  }

  try {
    await c.env.DB
      .prepare(
        `UPDATE users
         SET tier = ?,
             stripe_customer_id = COALESCE(?, stripe_customer_id)
         WHERE id = ?`
      )
      .bind(tierUpdate.tier, tierUpdate.customer_id ?? null, tierUpdate.user_id)
      .run();
    return c.json({ ok: true, user_id: tierUpdate.user_id, tier: tierUpdate.tier });
  } catch (err) {
    console.error('[stripe] tier update failed', err);
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// ==========================================================================
// PORTAL GENERATOR — build an /amzn-caliber 5-page portal for any ticker.
// Chains Workers AI models against the stock-pitch skill.
// ==========================================================================
app.post('/generate', async (c) => {
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const ticker = sanitizeTicker(String(body.ticker || ''));
  if (!ticker) return c.json({ error: 'Valid ticker required' }, 400);

  // Rate limit — portals cap at 100/hour per IP. ADMIN_KEY header bypasses.
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const isAdmin = c.env.ADMIN_KEY && c.req.header('x-admin-key') === c.env.ADMIN_KEY;
  if (!isAdmin) {
    const limit = await checkRateLimit(c.env.REQUESTS, `portal:ip:${ip}`, 100, 3600);
    if (!limit.allowed) return c.json({ error: 'Too many portal generations from this network. Try again in an hour.' }, 429);
  }

  // Lock entry price at submit time
  const { fetchPriceStrict } = await import('./lib/prices');
  const quote = await fetchPriceStrict(ticker);
  if (!quote) return c.json({ error: `Could not price ${ticker}. Check the symbol.` }, 400);

  const jobId = newId();
  const entryDate = new Date().toISOString();

  try {
    await c.env.DB.prepare(`
      INSERT INTO portal_jobs (id, ticker, company, direction, thesis, price_target, status, step, entry_price, entry_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', 'Queued — starting research', ?, ?, datetime('now'))
    `).bind(
      jobId,
      ticker,
      quote.company,
      body.direction || null,
      body.thesis || null,
      body.price_target ? Number(body.price_target) : null,
      quote.price,
      entryDate,
    ).run();
  } catch (e) {
    console.error('portal_jobs insert failed', e);
    return c.json({ error: 'Could not queue job' }, 500);
  }

  // SYNCHRONOUS generation — block the HTTP request until done.
  try {
    await generatePortal(c.env, jobId, ticker, quote);
  } catch (err) {
    console.error('[portal] inline generation failed', err);
    return c.json({ error: 'Generation failed: ' + String(err).slice(0, 200) }, 500);
  }

  // ── Confidence pipeline: critic + fact-verifier → portals table ──
  try {
    const memoHtml = await c.env.REQUESTS.get(`portal:${ticker}:memo`);
    const contentJson = await c.env.REQUESTS.get(`portal:${ticker}:content`);
    let summary = '', direction = 'long', rating = 'BUY', priceTarget = 0, sector = '';
    let totalWords = 0;

    if (contentJson) {
      try {
        const content = JSON.parse(contentJson);
        summary = (content.executiveSummary || '').slice(0, 300);
        priceTarget = content.priceTargetNum || 0;
        sector = content.sector || '';
        direction = content.direction || 'long';
        rating = content.rating || 'BUY';
      } catch {}
    }

    // Run critic (structural + LLM scoring)
    let criticScore = 50;
    try {
      if (memoHtml) {
        const { critiquePortal } = await import('./lib/improve/critic');
        const critique = await critiquePortal(c.env.AI, ticker, memoHtml);
        criticScore = critique.overall_score || 50;
      }
    } catch (e) {
      console.error('[confidence] critic failed (non-fatal)', e);
    }

    // Read fact verification results stored at generation time
    let verificationRate = 0, totalClaims = 0, verifiedClaims = 0;
    try {
      if (contentJson) {
        const content = JSON.parse(contentJson);
        verificationRate = content.verificationRate || 0;
        totalClaims = content.totalClaims || 0;
        verifiedClaims = content.verifiedClaims || 0;
      }
    } catch (e) {
      console.error('[confidence] fact-verify failed (non-fatal)', e);
    }

    // Word count from memo HTML
    if (memoHtml) {
      totalWords = memoHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    }

    const upside = quote.price > 0 && priceTarget > 0 ? (priceTarget - quote.price) / quote.price : 0;
    const confidence = Math.round((criticScore / 100) * 60 + verificationRate * 40);

    await c.env.DB.prepare(`
      INSERT INTO portals (id, ticker, company, sector, direction, rating, price_at_generation, price_target, upside_pct, critic_score, verification_rate, confidence_index, total_words, total_claims, verified_claims, summary, job_id, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(ticker) DO UPDATE SET
        company=excluded.company, sector=excluded.sector, direction=excluded.direction, rating=excluded.rating,
        price_at_generation=excluded.price_at_generation, price_target=excluded.price_target, upside_pct=excluded.upside_pct,
        critic_score=excluded.critic_score, verification_rate=excluded.verification_rate, confidence_index=excluded.confidence_index,
        total_words=excluded.total_words, total_claims=excluded.total_claims, verified_claims=excluded.verified_claims,
        summary=excluded.summary, job_id=excluded.job_id, generated_at=excluded.generated_at
    `).bind(
      newId(), ticker, quote.company, sector, direction, rating,
      quote.price, priceTarget, upside, criticScore, verificationRate, confidence,
      totalWords, totalClaims, verifiedClaims, summary, jobId
    ).run();

    console.log(`[confidence] ${ticker}: critic=${criticScore} verify=${(verificationRate*100).toFixed(0)}% confidence=${confidence} PT=$${priceTarget} upside=${(upside*100).toFixed(0)}% dir=${direction}`);

    // Auto-rebalance books after each generation
    try {
      const allP = await c.env.DB.prepare(
        'SELECT ticker, direction, confidence_index, upside_pct, price_at_generation, price_target FROM portals WHERE confidence_index > 0'
      ).all<{ ticker: string; direction: string; confidence_index: number; upside_pct: number; price_at_generation: number; price_target: number }>();
      const rows = allP.results ?? [];
      const longs = rows.filter(r => (r.upside_pct || 0) > 0.05 && r.confidence_index >= 30);
      const shorts = rows.filter(r => (r.upside_pct || 0) < -0.05 && r.confidence_index >= 30);

      await c.env.DB.prepare('DELETE FROM book_positions').run();
      const insertBook = async (book: string, positions: typeof rows) => {
        const totalScore = positions.reduce((s, p) => s + Math.abs(p.upside_pct || 0) * p.confidence_index, 0);
        for (const p of positions) {
          const score = Math.abs(p.upside_pct || 0) * p.confidence_index;
          const weight = totalScore > 0 ? score / totalScore : 1 / positions.length;
          await c.env.DB.prepare(
            'INSERT INTO book_positions (id, book, ticker, confidence_index, weight_pct, price_at_entry, price_target) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(newId(), book, p.ticker, p.confidence_index, weight, p.price_at_generation, p.price_target).run();
        }
      };
      await insertBook('long', longs);
      await insertBook('short', shorts);
      console.log(`[books] Rebalanced: ${longs.length} long, ${shorts.length} short`);
    } catch (e) {
      console.error('[books] rebalance failed (non-fatal)', e);
    }
  } catch (e) {
    console.error('[portal] portals table insert failed (non-fatal)', e);
  }

  return c.json({ ok: true, jobId, ticker, company: quote.company, redirect: `/stock-pitch/${ticker}` });
});

// ==========================================================================
// FEEDBACK — per-section ratings feed the self-improvement loop
// ==========================================================================
app.post('/api/feedback', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const ticker = sanitizeTicker(String(body.ticker || ''));
  if (!ticker) return c.json({ error: 'ticker required' }, 400);
  const section = String(body.section || '').slice(0, 100);
  const rating = Math.max(1, Math.min(5, parseInt(body.rating) || 3));
  const comment = String(body.comment || '').slice(0, 500) || null;
  const ip = c.req.header('cf-connecting-ip') || 'unknown';

  const portal = await c.env.DB.prepare('SELECT id FROM portals WHERE ticker = ?').bind(ticker).first<{ id: string }>();
  if (!portal) return c.json({ error: 'No portal found' }, 404);

  await c.env.DB.prepare(
    'INSERT INTO portal_feedback (id, portal_id, section, rating, comment, ip) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(newId(), portal.id, section, rating, comment, ip).run();

  return c.json({ ok: true });
});

// ==========================================================================
// BOOKS — rebalance long/short from confidence-weighted portals
// ==========================================================================
app.post('/api/books/rebalance', async (c) => {
  const allPortals = await c.env.DB.prepare(
    'SELECT ticker, direction, confidence_index, upside_pct, price_at_generation, price_target FROM portals WHERE confidence_index > 0'
  ).all<{ ticker: string; direction: string; confidence_index: number; upside_pct: number; price_at_generation: number; price_target: number }>();

  const rows = allPortals.results ?? [];
  // Score = |implied_upside| × confidence. Long book = positive upside, short = negative.
  const scored = rows.map(r => ({
    ...r,
    score: Math.abs(r.upside_pct || 0) * r.confidence_index,
  }));
  const longs = scored.filter(r => (r.upside_pct || 0) > 0.05 && r.confidence_index >= 30);
  const shorts = scored.filter(r => (r.upside_pct || 0) < -0.05 && r.confidence_index >= 30);

  const buildWeights = (positions: typeof scored) => {
    const totalScore = positions.reduce((s, p) => s + p.score, 0);
    return positions
      .sort((a, b) => b.score - a.score)
      .map(p => ({
        ticker: p.ticker,
        weight: totalScore > 0 ? p.score / totalScore : 1 / positions.length,
        confidence: p.confidence_index,
        pt: p.price_target,
        entry: p.price_at_generation,
      }));
  };

  const longWeights = buildWeights(longs);
  const shortWeights = buildWeights(shorts);

  await c.env.DB.prepare('DELETE FROM book_positions').run();

  for (const w of longWeights) {
    await c.env.DB.prepare(
      'INSERT INTO book_positions (id, book, ticker, confidence_index, weight_pct, price_at_entry, price_target) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(newId(), 'long', w.ticker, w.confidence, w.weight, w.entry, w.pt).run();
  }
  for (const w of shortWeights) {
    await c.env.DB.prepare(
      'INSERT INTO book_positions (id, book, ticker, confidence_index, weight_pct, price_at_entry, price_target) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(newId(), 'short', w.ticker, w.confidence, w.weight, w.entry, w.pt).run();
  }

  return c.json({
    ok: true,
    long: { count: longWeights.length, positions: longWeights },
    short: { count: shortWeights.length, positions: shortWeights },
  });
});

// ==========================================================================
// BATCH — seed queue + process next ticker
// ==========================================================================
const QQQ_TOP25 = ['AAPL','MSFT','NVDA','AMZN','META','AVGO','GOOGL','COST','TSLA','NFLX','AMD','QCOM','LIN','ADBE','TXN','ISRG','AMGN','BKNG','INTU','AMAT','PANW','MU','LRCX','KLAC','SNPS'];
const SPX_TOP25 = ['BRK.B','UNH','JPM','XOM','V','JNJ','PG','MA','HD','ABBV','CVX','MRK','LLY','PEP','KO','BAC','WMT','CRM','ORCL','CSCO','TMO','ACN','MCD','ABT','PM'];

app.post('/api/batch/seed', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const batch = body.batch || 'qqq+spx';
  const tickers = [...new Set([...QQQ_TOP25, ...SPX_TOP25])];

  let seeded = 0;
  for (const t of tickers) {
    try {
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO generation_queue (ticker, batch, priority) VALUES (?, ?, ?)'
      ).bind(t, batch, QQQ_TOP25.includes(t) ? 2 : 1).run();
      seeded++;
    } catch {}
  }

  return c.json({ ok: true, seeded, total: tickers.length, batch });
});

app.post('/api/batch/next', async (c) => {
  const next = await c.env.DB.prepare(
    'SELECT ticker FROM generation_queue WHERE status = ? ORDER BY priority DESC, created_at ASC LIMIT 1'
  ).bind('pending').first<{ ticker: string }>();

  if (!next) return c.json({ ok: true, done: true, message: 'Queue empty' });

  await c.env.DB.prepare(
    "UPDATE generation_queue SET status = 'processing', started_at = datetime('now') WHERE ticker = ?"
  ).bind(next.ticker).run();

  try {
    const { fetchPriceStrict } = await import('./lib/prices');
    const quote = await fetchPriceStrict(next.ticker);
    if (!quote) throw new Error(`Could not price ${next.ticker}`);

    const jId = newId();
    await c.env.DB.prepare(
      `INSERT INTO portal_jobs (id, ticker, company, status, step, entry_price, entry_date)
       VALUES (?, ?, ?, 'queued', 'Batch — starting research', ?, datetime('now'))`
    ).bind(jId, next.ticker, quote.company, quote.price).run();

    await generatePortal(c.env, jId, next.ticker, quote);

    // Run confidence pipeline inline
    const memoHtml = await c.env.REQUESTS.get(`portal:${next.ticker}:memo`);
    const contentJson = await c.env.REQUESTS.get(`portal:${next.ticker}:content`);
    let summary = '', direction = 'long', rating = 'BUY', priceTarget = 0, sector = '';
    let criticScore = 50, verificationRate = 0.5, totalWords = 0, totalClaims = 0, verifiedClaims = 0;

    if (contentJson) {
      try {
        const content = JSON.parse(contentJson);
        summary = (content.executiveSummary || '').slice(0, 300);
        priceTarget = content.priceTargetNum || 0;
        sector = content.sector || '';
        direction = content.direction || ((priceTarget > quote.price) ? 'long' : 'short');
        rating = content.rating || (direction === 'long' ? 'BUY' : 'SELL');
      } catch {}
    }

    if (memoHtml) {
      try {
        const { critiquePortal } = await import('./lib/improve/critic');
        const critique = await critiquePortal(c.env.AI, next.ticker, memoHtml);
        criticScore = critique.overall_score || 50;
      } catch (e) { console.error('[batch] critic failed', e); }

      totalWords = memoHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    }

    if (contentJson) {
      try {
        const { verifyPortal } = await import('./lib/improve/fact-verify');
        const content = JSON.parse(contentJson);
        const filingText = content.tenk_raw || '';
        if (filingText.length > 100) {
          const vr = verifyPortal(content, filingText);
          verificationRate = vr.verification_rate;
          totalClaims = vr.total_claims;
          verifiedClaims = vr.verified;
        }
      } catch (e) { console.error('[batch] verify failed', e); }
    }

    const upside = quote.price > 0 && priceTarget > 0 ? (priceTarget - quote.price) / quote.price : 0;
    const confidence = Math.round((criticScore / 100) * 60 + verificationRate * 40);

    await c.env.DB.prepare(`
      INSERT INTO portals (id, ticker, company, sector, direction, rating, price_at_generation, price_target, upside_pct, critic_score, verification_rate, confidence_index, total_words, total_claims, verified_claims, summary, job_id, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(ticker) DO UPDATE SET
        company=excluded.company, sector=excluded.sector, direction=excluded.direction, rating=excluded.rating,
        price_at_generation=excluded.price_at_generation, price_target=excluded.price_target, upside_pct=excluded.upside_pct,
        critic_score=excluded.critic_score, verification_rate=excluded.verification_rate, confidence_index=excluded.confidence_index,
        total_words=excluded.total_words, total_claims=excluded.total_claims, verified_claims=excluded.verified_claims,
        summary=excluded.summary, job_id=excluded.job_id, generated_at=excluded.generated_at
    `).bind(
      newId(), next.ticker, quote.company, sector, direction, rating,
      quote.price, priceTarget, upside, criticScore, verificationRate, confidence,
      totalWords, totalClaims, verifiedClaims, summary, jId
    ).run();

    await c.env.DB.prepare(
      "UPDATE generation_queue SET status = 'complete', completed_at = datetime('now') WHERE ticker = ?"
    ).bind(next.ticker).run();

    console.log(`[batch] ${next.ticker} done: confidence=${confidence} critic=${criticScore} verify=${(verificationRate*100).toFixed(0)}%`);
    return c.json({ ok: true, ticker: next.ticker, confidence, criticScore, verificationRate });

  } catch (err) {
    await c.env.DB.prepare(
      "UPDATE generation_queue SET status = 'failed', error = ? WHERE ticker = ?"
    ).bind(String(err).slice(0, 500), next.ticker).run();
    console.error(`[batch] ${next.ticker} failed:`, err);
    return c.json({ ok: false, ticker: next.ticker, error: String(err).slice(0, 200) }, 500);
  }
});

app.get('/api/batch/status', async (c) => {
  const counts = await c.env.DB.prepare(`
    SELECT status, COUNT(*) as count FROM generation_queue GROUP BY status
  `).all<{ status: string; count: number }>();
  const rows = await c.env.DB.prepare(
    'SELECT ticker, status, started_at, completed_at, error FROM generation_queue ORDER BY priority DESC, created_at ASC'
  ).all<any>();
  return c.json({ counts: counts.results, queue: rows.results });
});

app.get('/jobs/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const job = await c.env.DB
    .prepare('SELECT * FROM portal_jobs WHERE id = ?')
    .bind(jobId)
    .first<any>();
  if (!job) return c.text('Job not found', 404);
  const { renderPortalJobStatus } = await import('./pages/portal-job-status');
  return c.html(renderPortalJobStatus({
    jobId: job.id,
    ticker: job.ticker,
    status: job.status,
    step: job.step,
    pages_complete: job.pages_complete ?? 0,
    pages_total: job.pages_total ?? 5,
    error_message: job.error_message,
  }));
});

// Karpathy-style auto-research loop: critique a generated portal vs
// rubric, propose prompt fixes. Call with any ticker that has a portal
// already in KV.
app.post('/api/portal/critique', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const ticker = sanitizeTicker(String(body.ticker || ''));
  if (!ticker) return c.json({ error: 'ticker required' }, 400);
  const memoHtml = await c.env.REQUESTS.get(`portal:${ticker}:memo`);
  if (!memoHtml) return c.json({ error: `No portal for ${ticker}` }, 404);

  const { critiquePortal } = await import('./lib/improve/critic');
  const report = await critiquePortal(c.env.AI, ticker, memoHtml);

  // Log to KV for iteration audit trail
  const runKey = `critique:${ticker}:${Date.now()}`;
  try {
    await c.env.REQUESTS.put(runKey, JSON.stringify(report), { expirationTtl: 60 * 60 * 24 * 60 });
  } catch (e) {}

  return c.json(report);
});

app.get('/api/portal/critique/:ticker/latest', async (c) => {
  const ticker = sanitizeTicker(c.req.param('ticker'));
  if (!ticker) return c.json({ error: 'invalid ticker' }, 400);
  // List critiques for this ticker and return most recent
  const list = await c.env.REQUESTS.list({ prefix: `critique:${ticker}:` });
  if (!list.keys.length) return c.json({ error: 'no critiques yet' }, 404);
  const latest = list.keys.sort((a, b) => b.name.localeCompare(a.name))[0];
  const json = await c.env.REQUESTS.get(latest.name, 'json');
  return c.json(json);
});

app.get('/api/portal/jobs/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const job = await c.env.DB
    .prepare('SELECT id, ticker, status, step, pages_complete, pages_total, error_message FROM portal_jobs WHERE id = ?')
    .bind(jobId)
    .first<any>();
  if (!job) return c.json({ error: 'Job not found' }, 404);
  return c.json(job);
});

// Portal page serving — all 5 pages pull from KV after generation
const PORTAL_PAGES = ['index', 'memo', 'model', 'consensus', 'deck', 'questions'] as const;
for (const page of PORTAL_PAGES) {
  const path = page === 'index' ? '/:ticker' : `/:ticker/${page}`;
  app.get(path, async (c) => {
    const ticker = sanitizeTicker(c.req.param('ticker'));
    if (!ticker) return c.text('Invalid ticker', 400);
    const html = await c.env.REQUESTS.get(`portal:${ticker}:${page}`);
    if (!html) return c.text(`No portal for ${ticker} — generate one at /stock-pitch`, 404);
    return c.html(html);
  });
}

app.notFound((c) => c.text('Not Found', 404));

// ==========================================================================
// Path-mount fetch wrapper — when served at levincap.com/stock-pitch, strip
// the prefix before routing and rewrite absolute paths in the response so
// the app behaves as if it owned the whole origin. Other hosts (workers.dev,
// research.levincap.com, etc.) bypass this and hit Hono directly.
// ==========================================================================
// Any host receives the path-mount if the URL starts with /stock-pitch.
// That way research.levincap.com/stock-pitch/TICKER and the bare
// workers.dev subdomain (via /stock-pitch/TICKER) route identically —
// Hono routes are defined WITHOUT the prefix; the wrapper strips + rewrites.
// Host allow-list is left empty: rely purely on URL prefix.
const MOUNT_PREFIX = '/stock-pitch';
const RESEARCH_MOUNT = '/research';

/**
 * Portal generation pipeline — invoked via waitUntil() so the request
 * returns immediately while generation runs in the background.
 * Updates portal_jobs.status + step as it progresses for the progress UI.
 */
async function generatePortal(env: Env, jobId: string, ticker: string, quote: { company: string | null; price: number }): Promise<void> {
  const setStep = async (status: string, step: string, pagesComplete?: number) => {
    try {
      await env.DB.prepare(`
        UPDATE portal_jobs
        SET status = ?, step = ?${pagesComplete !== undefined ? ', pages_complete = ?' : ''}
        WHERE id = ?
      `).bind(...(pagesComplete !== undefined ? [status, step, pagesComplete, jobId] : [status, step, jobId])).run();
    } catch (e) { console.error('portal job update failed', e); }
  };
  const fail = async (msg: string) => {
    try {
      await env.DB.prepare(
        `UPDATE portal_jobs SET status='failed', error_message=?, completed_at=datetime('now') WHERE id=?`
      ).bind(msg, jobId).run();
    } catch (e) {}
  };

  try {
    const { collectResearch, writePortalContent } = await import('./lib/portal-generator');
    const { renderPortalMemo } = await import('./pages/portal-memo');
    const {
      renderPortalIndex,
      renderPortalModel,
      renderPortalConsensus,
      renderPortalDeck,
      renderPortalQuestions,
    } = await import('./pages/portal-pages');
    await setStep('researching', 'Fetching 10-K + 10-Q from EDGAR', 0);
    const research = await collectResearch({ ticker });
    if (!research.filing_10k_url) {
      return fail(`Could not locate SEC 10-K for ${ticker}. EDGAR may not have this ticker, or it's foreign-listed. Try another symbol.`);
    }

    await setStep('writing', 'Forming thesis · drafting all 6 sections', 1);
    const content = await writePortalContent(env.AI, research, { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY });

    // Fetch peer prices in parallel for the consensus page
    await setStep('writing', 'Pricing peer comps', 2);
    const peerTickers = Array.from(new Set(content.consensus.peerTickers));
    const peerResults = await Promise.all(peerTickers.map(t => fetchPrice(t)));
    const peerQuotes: Record<string, typeof peerResults[number]> = {};
    peerTickers.forEach((t, i) => { peerQuotes[t] = peerResults[i]; });

    await setStep('writing', 'Assembling 5 pages', 3);
    const now = new Date().toISOString();
    const common = {
      ticker: research.ticker,
      company: research.company,
      content,
      quote: research.quote,
      filing_10k_url: research.filing_10k_url,
      filing_10k_date: research.filing_10k_date,
      generated_at: now,
    };

    const pages: Record<string, string> = {
      index: renderPortalIndex(common),
      memo: renderPortalMemo(common),
      model: renderPortalModel(common),
      consensus: renderPortalConsensus({ ...common, peerQuotes }),
      deck: renderPortalDeck(common),
      questions: renderPortalQuestions(common),
    };

    await setStep('writing', 'Persisting pages to KV', 5);
    const ttl = 60 * 60 * 24 * 90; // 90 days
    await Promise.all([
      ...Object.entries(pages).map(([page, html]) =>
        env.REQUESTS.put(`portal:${research.ticker}:${page}`, html, { expirationTtl: ttl })
      ),
      env.REQUESTS.put(`portal:${research.ticker}:content`, JSON.stringify(content), { expirationTtl: ttl }),
    ]);

    await setStep('complete', 'Portal ready', 6);
    await env.DB.prepare(
      `UPDATE portal_jobs SET status='complete', step=?, pages_complete=6, pages_total=6, completed_at=datetime('now') WHERE id=?`
    ).bind('Portal ready', jobId).run();
  } catch (err) {
    console.error('[portal] generation failed', err);
    await fail(String(err).slice(0, 500));
  }
}

function isMounted(url: URL): boolean {
  return url.pathname === MOUNT_PREFIX || url.pathname.startsWith(MOUNT_PREFIX + '/');
}

function isResearchMounted(url: URL): boolean {
  return url.pathname === RESEARCH_MOUNT || url.pathname.startsWith(RESEARCH_MOUNT + '/');
}

function rewriteAbsolute(value: string | null): string | null {
  if (!value) return value;
  if (!value.startsWith('/')) return value;
  if (value.startsWith('//')) return value;
  if (value.startsWith(MOUNT_PREFIX + '/') || value === MOUNT_PREFIX) return value;
  return MOUNT_PREFIX + value;
}

function rewriteAbsoluteResearch(value: string | null): string | null {
  if (!value) return value;
  if (!value.startsWith('/')) return value;
  if (value.startsWith('//')) return value;
  if (value.startsWith(RESEARCH_MOUNT + '/') || value === RESEARCH_MOUNT) return value;
  return RESEARCH_MOUNT + value;
}

// Client-side wrapper that prefixes absolute-path fetch() calls and
// location.href writes with the mount prefix. Injected into every HTML
// response served under the mount.
const CLIENT_PATCH = `<script>(function(){
var base=${JSON.stringify(MOUNT_PREFIX)};
window.__BASE_PATH__=base;
var orig=window.fetch;
window.fetch=function(u,o){
  if(typeof u==='string'&&u[0]==='/'&&u[1]!=='/'&&u.indexOf(base+'/')!==0&&u!==base){u=base+u;}
  return orig.call(this,u,o);
};
var desc=Object.getOwnPropertyDescriptor(window.Location.prototype,'href')||Object.getOwnPropertyDescriptor(Location.prototype,'href');
// location.href setter intercept — fall back to monkey-patching on the instance.
try{Object.defineProperty(location,'href',{
  get:function(){return desc.get.call(location);},
  set:function(v){
    if(typeof v==='string'&&v[0]==='/'&&v[1]!=='/'&&v.indexOf(base+'/')!==0&&v!==base){v=base+v;}
    desc.set.call(location,v);
  }
});}catch(e){}
})();</script>`;

async function mountedFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Route agent WebSocket + API requests before Hono
  const reqUrl = new URL(request.url);
  if (reqUrl.pathname.startsWith('/agents/')) {
    console.log(`[agent-route] path=${reqUrl.pathname} upgrade=${request.headers.get('upgrade')} method=${request.method}`);
    try {
      const agentResp = await routeAgentRequest(request, env);
      if (agentResp) {
        console.log(`[agent-route] returned ${agentResp.status}`);
        return agentResp;
      }
    } catch (e) {
      console.error('[agent-route] threw:', e);
      return new Response('Agent routing error: ' + String(e), { status: 500 });
    }
  }

  const url = new URL(request.url);
  if (!isMounted(url)) return app.fetch(request, env, ctx);

  const innerUrl = new URL(request.url);
  const stripped = url.pathname.slice(MOUNT_PREFIX.length);
  innerUrl.pathname = stripped === '' ? '/' : stripped;
  const innerReq = new Request(innerUrl, request);
  const resp = await app.fetch(innerReq, env, ctx);

  // 3xx → prepend mount to Location header.
  if (resp.status >= 300 && resp.status < 400) {
    const loc = resp.headers.get('location');
    const newLoc = rewriteAbsolute(loc);
    if (newLoc && newLoc !== loc) {
      const h = new Headers(resp.headers);
      h.set('location', newLoc);
      return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
    }
    return resp;
  }

  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return resp;

  const rewriteAttr = (attr: string) => ({
    element(el: Element) {
      const v = el.getAttribute(attr);
      const nv = rewriteAbsolute(v);
      if (nv && nv !== v) el.setAttribute(attr, nv);
    },
  });

  return new HTMLRewriter()
    .on('a[href]', rewriteAttr('href'))
    .on('form[action]', rewriteAttr('action'))
    .on('link[href]', rewriteAttr('href'))
    .on('script[src]', rewriteAttr('src'))
    .on('img[src]', rewriteAttr('src'))
    .on('source[src]', rewriteAttr('src'))
    .on('iframe[src]', rewriteAttr('src'))
    .on('head', {
      element(el) { el.append(CLIENT_PATCH, { html: true }); },
    })
    .transform(resp);
}

// ==========================================================================
// CRON: nightly price refresh
// ==========================================================================
export default {
  fetch: mountedFetch,
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
      const slugs = ['top10'];
      await Promise.all(slugs.map(s => env.REQUESTS.delete(`og:p:${s}`)));
    } catch (e) {}

    // Step 3: process next ticker in batch generation queue
    try {
      const next = await env.DB.prepare(
        "SELECT ticker FROM generation_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
      ).first<{ ticker: string }>();

      if (next) {
        console.log(`[cron-batch] Processing ${next.ticker}...`);
        await env.DB.prepare(
          "UPDATE generation_queue SET status = 'processing', started_at = datetime('now') WHERE ticker = ?"
        ).bind(next.ticker).run();

        const quote = await fetchPrice(next.ticker);
        if (!quote) throw new Error(`Could not price ${next.ticker}`);

        const jId = newId();
        await env.DB.prepare(
          `INSERT INTO portal_jobs (id, ticker, company, status, step, entry_price, entry_date)
           VALUES (?, ?, ?, 'queued', 'Cron batch — starting research', ?, datetime('now'))`
        ).bind(jId, next.ticker, quote.company, quote.price).run();

        await generatePortal(env, jId, next.ticker, quote);

        // Inline confidence scoring
        const memoHtml = await env.REQUESTS.get(`portal:${next.ticker}:memo`);
        let criticScore = 50, verificationRate = 0.5, totalWords = 0;
        let summary = '', direction = 'long', rating = 'BUY', priceTarget = 0, sector = '';
        let totalClaims = 0, verifiedClaims = 0;

        const contentJson = await env.REQUESTS.get(`portal:${next.ticker}:content`);
        if (contentJson) {
          try {
            const content = JSON.parse(contentJson);
            summary = (content.executiveSummary || '').slice(0, 300);
            priceTarget = content.priceTargetNum || 0;
            sector = content.sector || '';
            direction = content.direction || ((priceTarget > quote.price) ? 'long' : 'short');
            rating = content.rating || (direction === 'long' ? 'BUY' : 'SELL');
          } catch {}
        }

        if (memoHtml) {
          totalWords = memoHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
          try {
            const { critiquePortal } = await import('./lib/improve/critic');
            const critique = await critiquePortal(env.AI, next.ticker, memoHtml);
            criticScore = critique.overall_score || 50;
          } catch {}
        }

        if (contentJson) {
          try {
            const { verifyPortal } = await import('./lib/improve/fact-verify');
            const content = JSON.parse(contentJson);
            const filingText = content.tenk_raw || '';
            if (filingText.length > 100) {
              const vr = verifyPortal(content, filingText);
              verificationRate = vr.verification_rate;
              totalClaims = vr.total_claims;
              verifiedClaims = vr.verified;
            }
          } catch {}
        }

        const upside = quote.price > 0 && priceTarget > 0 ? (priceTarget - quote.price) / quote.price : 0;
        const confidence = Math.round((criticScore / 100) * 60 + verificationRate * 40);

        await env.DB.prepare(`
          INSERT INTO portals (id, ticker, company, sector, direction, rating, price_at_generation, price_target, upside_pct, critic_score, verification_rate, confidence_index, total_words, total_claims, verified_claims, summary, job_id, generated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(ticker) DO UPDATE SET
            company=excluded.company, sector=excluded.sector, direction=excluded.direction, rating=excluded.rating,
            price_at_generation=excluded.price_at_generation, price_target=excluded.price_target, upside_pct=excluded.upside_pct,
            critic_score=excluded.critic_score, verification_rate=excluded.verification_rate, confidence_index=excluded.confidence_index,
            total_words=excluded.total_words, total_claims=excluded.total_claims, verified_claims=excluded.verified_claims,
            summary=excluded.summary, job_id=excluded.job_id, generated_at=excluded.generated_at
        `).bind(
          newId(), next.ticker, quote.company, sector, direction, rating,
          quote.price, priceTarget, upside, criticScore, verificationRate, confidence,
          totalWords, totalClaims, verifiedClaims, summary, jId
        ).run();

        await env.DB.prepare(
          "UPDATE generation_queue SET status = 'complete', completed_at = datetime('now') WHERE ticker = ?"
        ).bind(next.ticker).run();

        console.log(`[cron-batch] ${next.ticker} done: confidence=${confidence}`);
      }
    } catch (err) {
      console.error('[cron-batch] failed:', err);
    }
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
    // Hide only calls with literal 0% return (price fetch failure where
    // current_price == entry_price exactly). Fresh calls with tiny movement
    // stay visible so users see their submission immediately.
    .filter(r => r.current_price !== r.entry_price)
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
