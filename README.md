# stock-pitch-web

> MVP: a leaderboard for equity research. Submit a call. Get the AI-generated report. Let the market score it.

Deployed at **https://stock-pitch-web.evan-ratner.workers.dev** (moves to `stockpitch.app` + `research.levincap.com` once domains connect).

## What it does

1. **Submit a call** — pick a ticker, bull or bear, price target, write 2-4 sentences of thesis. Progressive Typeform-style flow. Mobile-first.
2. **AI generates a research brief** — Gemma 4 on Cloudflare Workers AI extends your thesis into a 500-word institutional-grade research report. ~$0.02 per generation.
3. **Share your call** — auto-generated 1200×630 OG share card via Browser Rendering. Your name, your ticker, your thesis on a branded image Twitter/LinkedIn unfurls beautifully.
4. **Tracked live on the leaderboard** — entry price locked at submission; ranked by price performance since entry. No bias, no voting, no subjective score.

## Two brands, one Worker (A/B test)

- **stockpitch.app** → `Stock Pitch` — standalone product brand, startup aesthetic
- **research.levincap.com** → `Levin Capital Research` — editorial/institutional, Playfair + Cormorant, paper + ink + gold

Both share the same backend. Worker detects host and renders the corresponding brand.

## Architecture

- **Cloudflare Worker** — Hono router, single Worker serves both brands
- **D1** — users, calls, prices, portfolios (v2), auth_tokens (v2)
- **KV** — cached AI briefs, legacy portal requests
- **Workers AI** — Gemma 4 26B for brief generation
- **Browser Rendering** — Puppeteer-in-Workers for OG PNG screenshots
- **Cron** — nightly price refresh

## Price sources (tiered)

1. D1 `prices` table (populated by cron; instant)
2. Yahoo Finance (free, no key, server-side fetch)
3. Deterministic mock (fallback so UX never breaks)

LiquidityBook integration planned for v2 as a nightly batch cache for LCS-book tickers. LB's async positions API (~100s poll cycle, 1-concurrent-call limit) is unsuitable for live submit lookups.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing (brand-aware) |
| `/submit` | Progressive step-based submit flow |
| `/leaderboard` | Public leaderboard (desktop table + mobile card stack) |
| `/c/:id` | Individual call page — thesis + AI brief + share buttons |
| `/c/:id/card` | Share card HTML (rendered by Browser Rendering) |
| `/c/:id/og.png` | 1200×630 PNG share image for OG tags |
| `POST /api/calls` | Submit a call (fires background AI brief generation) |
| `GET /api/price?ticker=` | Live price lookup for submit form |
| `GET /api/leaderboard` | JSON feed of the leaderboard |
| `GET /api/brand` | Brand detection probe |
| `GET /admin/calls?key=...` | Admin: recent calls |

## Setup

```bash
npm install
npx wrangler login
npx wrangler d1 create stock-pitch-db     # if new
npx wrangler d1 execute stock-pitch-db --remote --file=src/db/schema.sql
npx wrangler d1 execute stock-pitch-db --remote --file=src/db/seed.sql
npx wrangler deploy
```

### Optional secrets

```bash
# For production use of FMP as a price fallback (otherwise falls through to Yahoo + mock)
npx wrangler secret put FMP_API_KEY
```

## Product tiers

| Tier | Product | Price |
|---|---|---|
| **Free** | One call + AI brief + leaderboard entry | $0 |
| **Pro** | Unlimited calls, private sharing, priority support | $29/mo |
| **White-Glove** | Evan-curated full 6-page research portal, bespoke | $299 one-off |

Pro and White-Glove are v2 — Stripe integration not yet wired.

## What's next

- [ ] Magic-link auth (currently email-as-identity)
- [ ] Stripe for Pro tier
- [ ] Email notifications (call submitted, brief ready)
- [ ] Portfolios — auto-constructed model portfolios from top-10 leaderboard calls
- [ ] Custom domain wiring (stockpitch.app + research.levincap.com)
- [ ] LiquidityBook nightly position-price cache

## License

MIT. Built on Cloudflare Workers.
