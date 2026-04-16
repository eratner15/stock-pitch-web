# Stock Pitch Web — Handoff Prompt

Copy everything below this line and paste it as your first message in a new Claude Code session.

---

I'm continuing work on stock-pitch-web, an AI-powered equity research portal generator for Levin Capital. Clone and set up:

```bash
git clone https://github.com/eratner15/stock-pitch-web.git
cd stock-pitch-web
npm install
```

## What this is

The "infinite research desk" — enter a ticker, get a 15-section institutional investment memo with financial model, consensus/peer comps, pitch deck, and diligence questions. All tabs auto-generated.

**Live:** https://research.levincap.com/stock-pitch/
**Best example:** https://research.levincap.com/stock-pitch/NVDA/memo

## Architecture

```
Homepage (enter ticker) → /research?ticker=X (progress UI) → /generate (sync, 2-3 min)
→ 15-section memo + model + consensus + deck + questions stored in KV
→ /library shows all portals ranked by confidence → long/short books auto-constructed
```

**Three-layer stack:**
- **Fat skills (top):** prompts in portal-generator.ts encode equity research judgment
- **Thin harness (middle):** index.ts routes, ~200 LOC dispatch logic
- **Deterministic foundation (bottom):** edgar.ts (SEC), prices.ts (Yahoo), fact-verify.ts, charts.ts

**Model routing:**
- Workers AI Llama 3.3 70B: all 16 prose sections (free)
- Anthropic Claude Sonnet: financials JSON + consensus JSON fallback (paid, reliable for structured data)
- Workers AI Llama 8B: deck slides + diligence Qs (fast)

**Key files:**
- `src/lib/portal-generator.ts` — the orchestrator (Phase 1 foundation → Phase 2 prose → Phase 3 polish)
- `src/pages/portal-memo.ts` — memo template
- `src/pages/portal-layout.ts` — shared CSS + portalMarkdown() renderer
- `src/agents/research-agent.ts` — Claude-powered DO agent (native Anthropic SDK)
- `src/index.ts` — Hono routes + generatePortal + batch queue + books

## Deploy

```bash
nvm use 22
NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt npx wrangler deploy
```

Secrets needed: `ANTHROPIC_API_KEY` (for financials JSON fallback + agent)

## Current state (v0.18.0)

**Working:**
- 6 portals live (NVDA, GOOGL, AAPL, MSFT, AMZN, COST) — all tabs populated
- Memo: 10-11K words, 200-370 source tags per ticker
- Model page: 14-row financial tables (via Anthropic fallback)
- Consensus: peer comps with live prices, PT + methodology
- Deck: 8 slides with speaker notes
- Research Library at /library with confidence-weighted long/short books
- Claude-powered agent at /api/agent/research (native Anthropic SDK, tool calling works)
- Batch queue: 50 QQQ+SPX tickers seeded (paused), cron every 3 min
- Karpathy critic at /api/portal/critique scores 0-100

**Just shipped (v0.18.0):**
- Prompt quality overhaul — bold sub-headings, markdown tables, bullet lists, short paragraphs
- portalMarkdown() now converts markdown tables to HTML
- NVDA regenerating with new prompts (check results)

**Known issues:**
- Workers AI has 24K token limit — context capped at 40K chars (22K mda + 10K risks + 8K 10q)
- Workers AI drops concurrent calls to same model — all calls sequential within each phase
- Think + external LLM providers broken (Zod v4 schema bug) — filed cloudflare/agents#1322
- META CIK missing from ticker map — generation fails for META
- Model page financials JSON fails ~50% on Workers AI, recovered by Anthropic fallback

## What to work on next

1. **Check NVDA quality** after v0.18.0 prompt upgrade — screenshot memo, verify sub-headings/tables render
2. **Wire inline SVG charts** into memo (code exists in `src/lib/charts.ts`, not yet called from portal-memo.ts)
3. **Regenerate all 6 tickers** with the quality prompts
4. **Resume batch queue** — unpause 49 tickers: `UPDATE generation_queue SET status = 'pending' WHERE status = 'paused'`
5. **Think migration** — waiting on cloudflare/agents#1322 fix for Zod v4 + external providers
6. **Improve memo template** — pagination/collapsible sections for long memos, key figure callout boxes

## Wrangler config

D1: stock-pitch-db (ec74e895). KV: REQUESTS (3b589a51). Workers AI + Browser bindings.
Routes: levincap.com/stock-pitch/*, research.levincap.com/stock-pitch/*
Crons: nightly price refresh + batch queue every 3 min.
DOs: ResearchAgent (Claude agent), WorkflowAgent.

## Quick commands

```bash
# Regenerate a ticker
curl -X POST -H 'Content-Type: application/json' -d '{"ticker":"NVDA"}' https://research.levincap.com/stock-pitch/generate

# Check quality
curl -s https://research.levincap.com/stock-pitch/NVDA/memo | grep -oi "pending" | wc -l

# Run agent
curl -X POST -H 'Content-Type: application/json' -d '{"ticker":"META"}' https://research.levincap.com/stock-pitch/api/agent/research

# Check batch status
curl https://research.levincap.com/stock-pitch/api/batch/status

# Rebalance books
curl -X POST https://research.levincap.com/stock-pitch/api/books/rebalance
```
