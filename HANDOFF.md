# Stock Pitch Web — Handoff Prompt

Copy everything below this line and paste it as your first message in a new Claude Code session.

---

I'm continuing work on stock-pitch-web, the Levin Capital research platform. It has two products in one worker:

1. **Stock Pitch** — enter a ticker, get a 15-section institutional investment memo (levincap.com/stock-pitch)
2. **Research Desk** — 10 AI workflows (screen, DCF, comps, earnings, etc.) powered by Durable Object agents (levincap.com/research)

```bash
cd /home/eratner/stock-pitch-web  # or: git clone https://github.com/eratner15/stock-pitch-web.git
npm install
```

## Live URLs

| Product | URL | Status |
|---------|-----|--------|
| Stock Pitch landing | levincap.com/stock-pitch | Working |
| Stock Pitch portals | levincap.com/stock-pitch/NVDA/memo | Working (6 tickers) |
| Research Desk dashboard | levincap.com/research | Working |
| Research Desk workflows | levincap.com/research/screen?ticker=AAPL | Working (10 workflows) |
| Research Desk on research subdomain | research.levincap.com/research | Working |
| Workers.dev | stock-pitch-web.evan-ratner.workers.dev | Working |

## Architecture

```
Two products, one worker (stock-pitch-web), one D1 database (stock-pitch-db):

STOCK PITCH (existing):
  Homepage → /research-single?ticker=X → /generate (2-3 min) → 6-tab portal in KV
  ResearchAgent DO (Claude Sonnet) for agentic pitch generation
  Workers AI Llama 70B for prose, Anthropic for structured JSON fallback

RESEARCH DESK (new, Phases 1-3 complete):
  /research → dashboard with 10 workflow cards
  /research/:workflow?ticker=X → input form + SSE streaming progress
  /research/api/run → POST to create run → WorkflowAgent DO
  WorkflowAgent DO: parameterized agentic loop, Claude Sonnet + tool use
  10 skill markdowns loaded as system prompts via wrangler [[rules]]
  LB client ported for portfolio/morning workflows
```

**Fat skills / thin harness / deterministic foundation:**
- Skills (top): `src/skills/workflows/*.md` — 10 research workflow prompts
- Harness (middle): `src/index.ts` — Hono routes, ~100 LOC for research desk dispatch
- Foundation (bottom): `src/lib/edgar.ts`, `src/lib/prices.ts`, `src/lib/lb-client.ts`

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main Hono router (2100+ lines), all routes, cron handler |
| `src/agents/research-agent.ts` | Original ResearchAgent DO for pitch generation |
| `src/agents/workflow-agent.ts` | New WorkflowAgent DO — parameterized for all 10 workflows |
| `src/lib/workflow-config.ts` | Registry: maps 10 slugs to system prompts, tools, templates |
| `src/lib/lb-client.ts` | LiquidityBook API client (ported from lcs-portfolio-intel) |
| `src/lib/portal-generator.ts` | Portal generation orchestrator (Workers AI + Anthropic) |
| `src/pages/research-desk.ts` | Research Desk dashboard page |
| `src/pages/workflow-run.ts` | Universal workflow execution page (SSE + output render) |
| `src/skills/workflows/*.md` | 10 skill markdown files (screen, dcf, comps, etc.) |
| `src/brands/levincap.ts` | Levin Capital design system (Fraunces, banker green, parchment) |
| `wrangler.toml` | Routes, DO bindings, D1, KV, crons |

## D1 Schema (stock-pitch-db)

Original tables: users, calls, prices, price_history, auth_tokens, portfolios, portfolio_positions, portfolio_followers, portfolio_nav_history, portals, portal_feedback, book_positions, portal_jobs, generation_queue

**Migration 005 (Research Desk):** workflow_runs, workflow_outputs, lb_positions_cache

## Deploy

```bash
source ~/.nvm/nvm.sh && nvm use 20
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt npx wrangler deploy
```

Secrets needed: `ANTHROPIC_API_KEY`, `SESSION_SECRET`
Optional: `LIQUIDITYBOOK_CLIENT_ID`, `LIQUIDITYBOOK_CLIENT_SECRET` (for portfolio/morning workflows)

## Wrangler Config

- D1: stock-pitch-db (ec74e895)
- KV: REQUESTS (3b589a51) — portal HTML cache + LB token cache
- DOs: ResearchAgent (pitch agent), WorkflowAgent (research desk agent)
- Workers AI + Browser Rendering bindings
- Routes: levincap.com/stock-pitch/*, levincap.com/research/*, research.levincap.com/research/*
- Crons: nightly price refresh (0 23 * * *), batch queue every 3 min (*/3 * * * *)

## Current State (as of 2026-04-16)

### Working
- 6 stock pitch portals live (NVDA, GOOGL, AAPL, MSFT, AMZN, COST) — all tabs
- Research Desk dashboard with all 10 workflow cards
- All 10 workflow pages render correctly with Levin Capital branding
- API endpoints return JSON on both levincap.com and workers.dev
- WorkflowAgent DO deployed with SSE streaming support
- LB client ported, position sync wired to cron (needs LB secrets set)
- Auth: magic-link + JWT, session cookie works across both /stock-pitch and /research

### Known Issues
- Workflow runs require auth — no test run done yet (need to log in first)
- LB secrets not yet set (`wrangler secret put LIQUIDITYBOOK_CLIENT_ID` etc.)
- Workers AI 24K token limit constrains portal generation context
- Think + external LLM providers broken (Zod v4 bug, cloudflare/agents#1322)

### Taxonomy (DONE as of 2026-04-16)
- **research.levincap.com/** → 302 to /research → Research Desk (PRIMARY)
- **research.levincap.com/research** → Research Desk dashboard
- **research.levincap.com/digest** → Ratlinks magazine (was at root)
- **research.levincap.com/{ticker}** → static portals (AMZN, KMB, etc.)
- **levincap.com/research** → Research Desk (alias, also works)
- **levincap.com/stock-pitch** → Stock Pitch builder (unchanged)

The root redirect and /digest route live in lcs-portfolio-intel (src/index.ts ~line 5860). Not in git — deployed directly via wrangler.

## What to Work on Next

1. **Test end-to-end workflow** — log in, run Stock Screen for AAPL, verify SSE streaming + output
2. **Set LB secrets** — `wrangler secret put LIQUIDITYBOOK_CLIENT_ID` and `LIQUIDITYBOOK_CLIENT_SECRET`
3. **History page** — /research/history with search/filter by ticker, workflow, date
4. **Portal generation from workflow output** — "Generate Portal" button chains to existing pipeline
5. **Cross-workflow linking** — Coverage report can reference prior DCF/Comps for same ticker
6. **Tier gating** — free = 3 runs/month, pro = unlimited (wire to existing Stripe billing)

## Quick Commands

```bash
# Deploy
source ~/.nvm/nvm.sh && nvm use 20 && NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt npx wrangler deploy

# Test API (should return {"error":"Unauthorized"})
curl -s -X POST https://levincap.com/research/api/run -H 'Content-Type: application/json' -d '{"workflow":"screen","ticker":"AAPL"}'

# Check research desk loads
curl -sI https://levincap.com/research

# Regenerate a portal
curl -X POST -H 'Content-Type: application/json' -d '{"ticker":"NVDA"}' https://levincap.com/stock-pitch/generate

# Run research agent
curl -X POST -H 'Content-Type: application/json' -d '{"ticker":"META"}' https://levincap.com/stock-pitch/api/agent/research

# Apply D1 migration
npx wrangler d1 execute stock-pitch-db --remote --file=src/db/migrations/005_research_desk.sql
```
