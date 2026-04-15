---
name: stock-pitch
description: |
  Build and deploy a complete equity research investment portal for any publicly
  traded stock. AI-first: autonomously researches the company from primary sources
  (SEC filings, earnings transcripts, IR materials, live market data), forms a
  proprietary thesis, builds a multi-year financial model, and generates 5
  interconnected HTML pages deployed as a Cloudflare Worker. Sell-side research
  PDFs are optional enrichment, not required input.

  Use when asked to "build a portal", "create a stock site", "pitch [TICKER]",
  "build an investment page for [TICKER]", "stock-pitch [TICKER]", or "create
  research for [company]".
---

# Stock Pitch — Institutional Equity Research Portal Builder

## Philosophy

**AI-first, not sell-side-first.** The skill autonomously researches a company
from primary public sources, forms its own thesis, and builds the portal.
Sell-side PDFs are optional validation, not the foundation.

**Zero hallucination tolerance.** Every financial figure must trace to a
verifiable source: SEC filing, company IR page, or live market data. If a
number cannot be sourced, flag it as an estimate with the methodology shown.

**Sector-aware architecture.** Different businesses demand different analytical
frameworks. A trucking company needs an operating-ratio model; an alt asset
manager needs an FRE/DE/AUM algorithm; a REIT needs NAV/cap-rate; a merger
situation needs an accretion/dilution walk with synergy phasing. The skill
detects sector and picks the right template.

**Institutional presentation.** Five interconnected pages — index, memo,
presentation, interactive model, consensus — deployed as a single Cloudflare
Worker at `/lcs/<ticker>/`. Every page shares design language, navigation,
and data sources. The result feels like a bulge-bracket research product.

## Anti-Hallucination Protocol

Every data point must carry one of these source tags:

| Tag | Meaning | Example |
|-----|---------|---------|
| `[10-K]` | SEC annual filing | Revenue, segment breakdown, risk factors |
| `[10-Q]` | SEC quarterly filing | Quarterly revenue, recent guidance |
| `[Transcript]` | Earnings call transcript | Management quotes, guidance color |
| `[IR]` | Investor relations page | Shareholder letter, press release |
| `[Market]` | Live market data via web search | Price, market cap, shares outstanding |
| `[Consensus]` | Aggregated analyst estimates | Mean EPS, revenue estimates |
| `[Sell-Side]` | Named analyst report (if provided) | Barclays PT $300 |
| `[Computed]` | Derived from sourced inputs | EV/EBITDA = (mkt cap + debt − cash) / EBITDA |
| `[Estimated]` | AI estimate with methodology shown | "Based on 3-year CAGR of segment" |

**Rules:**
- Historical financials (revenue, EPS, margins) MUST come from `[10-K]` or `[10-Q]`
- Forward estimates must be `[Consensus]`, `[Sell-Side]`, or `[Estimated]` with method
- Quotes MUST be `[Transcript]` or `[IR]` with speaker attribution
- Never present an AI estimate as a fact — always label it

## Required Inputs

| Required | Purpose |
|----------|---------|
| Ticker | The stock to research |

| Optional (Enrichment) | Purpose |
|------------------------|---------|
| Sell-side research PDFs | Cross-check AI thesis, extract analyst PTs |
| Company earnings deck | Supplement filing data with visual context |
| Earnings transcripts | Management quotes, Q&A color |
| Specific URL (IR page, letter) | Targeted content to incorporate |
| Merger/M&A context | Triggers accretion/dilution workflow |

## v1.1 Capabilities (Added April 2026)

- **Page 6: Questions for Management** — diligence toolkit with 20 probe questions organized by category. Each question has rationale and red-flag answer markers. See `examples/bx/bx-questions.ts` and `examples/kmb/kmb-questions.ts`.
- **Probability-weighted scenarios** — interactive model now includes a probability panel where users assign weights to Bull/Base/Street/Bear and get an expected-value PT. See `examples/bx/bx-model.ts`.
- **URL-encoded scenario sharing** — Share button on model pages encodes slider state to URL hash. Recipients open the exact scenario. See "Phase 3.5" below.
- **PDF export** — print-optimized CSS on memo, questions, and model pages. One-click distribution.

## Execution Workflow

### Phase 1: Autonomous Data Collection

Gather ALL data before writing any pages. Every item must be sourced.

#### 1A. SEC Filings (Primary Source of Truth)

**WebFetch approach (preferred):**

```
WebFetch https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={TICKER}&type=10-K&dateb=&owner=include&count=1
→ Extract the filing URL from the results
WebFetch {filing_url}
→ Extract financials from the 10-K HTML
```

**Extract from 10-K:**
- Income Statement: Revenue by segment (3yr), operating income by segment, net income, EPS
- Balance Sheet: Cash & equivalents, total debt, total assets, stockholders' equity, shares outstanding
- Cash Flow: Operating CF, capex, FCF (OCF − Capex), dividends, buybacks
- Risk Factors: Top 5 material risks (skip boilerplate)
- Segment descriptions, KPIs, geographic breakdown
- Equity investments / unconsolidated interests (for SOTP)
- Management guidance (if in filing)

**Verification:** Cross-check 3 numbers against a web source (MacroTrends, SEC filing summary)

#### 1B. Earnings Transcripts & IR Materials

WebSearch for:
- Latest earnings call transcript
- CEO/CFO shareholder letter
- Most recent investor day presentation
- Any URLs provided by the user

Extract:
- Management guidance (revenue, margins, capex)
- Key quotes (with speaker attribution)
- Strategic priorities and initiatives
- Capital allocation framework

#### 1C. Live Market Data

WebSearch for current:
- Stock price, market cap, shares outstanding
- 52-week range, average daily volume
- Dividend yield (if applicable)
- Consensus analyst estimates (EPS, revenue for next 2-3 years)
- Analyst ratings distribution (buy/hold/sell count)
- Mean and median price targets
- Recent analyst upgrades/downgrades

#### 1D. Sell-Side Research (If PDFs Provided)

If user provides research PDFs:
- Extract via PyMuPDF (`fitz`)
- Pull: price targets, rating, key estimates, thesis points, management quotes
- Flag where sell-side estimates differ from AI's own analysis
- These supplement but don't replace primary source data

### Phase 2: AI Analysis (Skill Chaining)

Run analysis using other installed skills as building blocks. Each skill
produces structured output that feeds into the portal pages.

#### 2A. Financial Model — Chain `/3-statements`

Build the 3-statement model from 10-K data:
- Income statement: 3yr historical + 3yr projected
- Balance sheet: assets, liabilities, equity
- Cash flow statement with FCF derivation

Use management guidance and historical growth rates for projections.
Label all forward estimates as `[Estimated]` with methodology.

#### 2B. Peer Comp — Chain `/comps`

```
/comps {TICKER}
```

The skill will:
1. Identify 5-8 comparable companies (same sector, similar scale)
2. Pull operating metrics (Revenue, EBITDA, margins, growth rates)
3. Pull valuation multiples (EV/Revenue, EV/EBITDA, P/E, FCF Yield)
4. Calculate statistical summary (median, mean, discount/premium)

**Use the comps output to populate:**
- Consensus page → "Valuation vs Peers" table
- Model page → default multiple ranges for sliders
- Memo → valuation section peer benchmarks
- Presentation → valuation slide peer data

If `/comps` is unavailable, use WebSearch to manually gather:
- 5 closest public peers by business model and revenue scale
- NTM EV/EBITDA, NTM P/E, NTM EV/Revenue for each
- Revenue growth rate and key margin for each
- Calculate peer average and target company's discount/premium

#### 2C. DCF — Chain `/dcf`

Build a DCF using the 3-statement model outputs:
- 5-year explicit FCF projections
- WACC calculation (with sourced inputs)
- Terminal value via Gordon Growth
- Sensitivity tables (WACC vs terminal growth)

#### 2D. Competitive Landscape — Chain `/competitive-analysis`

Analyze competitive positioning:
- Market share data
- Key competitive advantages / moats
- Threat assessment
- Industry dynamics

#### 2E. Merger Model — Chain `/investment-banking:merger-model` (if applicable)

If the target company is involved in announced M&A (either as acquirer or
target), chain `/investment-banking:merger-model` to build:

- Accretion/dilution walk (pro-forma vs standalone EPS)
- Synergy phasing schedule (front-loaded or back-loaded based on management guidance)
- Combined pro-forma P&L through Year 4
- Pro-forma leverage bridge
- Sensitivity: synergy capture × debt cost / P/E multiple

See `references/sector-patterns.md` section "M&A / Merger Situations" for pattern.

#### 2F. AI Thesis Formation

Using ALL collected data, form a proprietary thesis:

**The thesis must answer:**
1. What is the market missing? (the variant perception)
2. What are the 3 key catalysts?
3. What is the biggest risk the market is correctly pricing?
4. What is the 12-month risk/reward setup?

**Rating framework:**
- BUY: >20% upside with identifiable catalysts
- HOLD: Fair value within 10%, no clear catalyst
- SELL: >15% downside or deteriorating fundamentals

**Price target derivation:**
- Primary: DCF from Phase 2C
- Cross-check: EV/EBITDA on forward estimates
- Cross-check: Peer-relative valuation from Phase 2B
- If sell-side provided: Compare to consensus PT and explain differences

### Phase 3: Build 6 HTML Pages

Read `references/page-structures.md` and `references/design-system.md` before
building. Each page uses:
- **Design system:** `references/design-system.md`
- **Page structure:** `references/page-structures.md`
- **Model template:** `references/model-templates.md`
- **Sector patterns:** `references/sector-patterns.md`

Copy the template files from `references/templates/` as starting points and
populate with actual research data.

#### Page 1: Landing (index)

- Hero with company context + dual PT badges (Street + LCS)
- 7-metric bar (price, mkt cap, revenue, EPS, key segment metric, valuation multiple, forward estimate)
- BLUF thesis (3 paragraphs, all claims sourced)
- 3 thesis cards (the variant perception pillars)
- Sector-appropriate section (M&A → deal snapshot + pro-forma P&L; Alt Mgr → AUM by segment + FRE/DE trajectory; etc.)
- Earnings setup box (next quarter estimates, what to watch, risks into print)
- Module cards linking to other 4 pages
- Sell-side quotes (from PDFs if provided, or from consensus data)
- Metric tooltips — every metric-val has `title` showing exact data source
- "Hover for sources" hint under metrics bar

#### Page 2: Investment Memo

- Merriweather serif body, SCQA framework
- 3,000+ words of narrative prose (no bullet lists)
- SCQA broken into labeled sub-paragraphs: Situation, Complication, Question, Answer
- 8+ Tufte sidenotes with sourced facts throughout
- Financial trajectory table with sourced historical + estimated forward data
- SOTP section with equity stakes breakdown (if applicable)
- Valuation section with DCF, multiples, peer-relative
- Risk assessment (from 10-K risk factors, not generic)
- Every number tagged with source
- Methodology footnotes after financial tables
- Sources & Methodology box before footer (Primary, Sell-Side, Market Data)
- Print CSS — nav hidden, sidenotes inline, tables no-break

#### Page 3: Presentation Deck

- 14-slide carousel
- Cover slide (dark gradient, dual PT badges, 3 key stat boxes)
- Segment analysis, thesis slides, financial summary
- Valuation and risk assessment with 3-framework price target grid (DCF, Multiples, SOTP / or method-appropriate)
- Catalyst calendar
- Source lines on 8+ data-heavy slides (financial summary, valuation, recommendation)
- Keyboard arrow navigation + clickable dots

#### Page 4: Interactive Model

**Follow the appropriate sector template from `references/model-templates.md`.**

Core features across all sector templates:
- Multi-year projections (3 forward years minimum)
- 12+ sliders organized in 4-5 control groups, sector-appropriate
- Bull / Base / Street / Bear presets (Street = consensus)
- DCF valuation with 5-year FCF + terminal
- Cross-check valuation (EV/EBITDA for most; P/DE for alt mgrs; NAV for REITs)
- Blended fair value with smart blend adjustment
- Multi-year financial bridge showing revenue, margins, EPS, FCF
- 2D sensitivity tables (at least 2: primary × multiple; primary × assumption)
- Scenario table with probability-weighted outcomes
- Keyboard shortcuts (1/2/3/4 for presets, R for reset)
- Slider rationale tooltips (every label has `title` explaining WHY the default)

#### Page 5: Consensus

- Consensus strip (rating, PT, range, analyst count) with source tooltips
- Rating distribution bar
- Analyst table (10 analysts across the rating spectrum)
- Key takeaways (2-column cards: "Street Gets This Right" vs "LCS Variant Perception")
- "Where the Street Is Wrong" navy box — proprietary AI view with specific numeric deltas
- Peer comparison table with discount/premium to peer average
- Forward estimate detail (revenue, EPS, margins, FCF)
- Management quotes (sourced from transcripts)
- Catalyst calendar
- Data source footnotes after every data table
- Master Data Sources disclaimer before footer

#### Page 6: Questions for Management

A diligence toolkit with 20 hand-crafted probe questions for buy-side meetings, conference Q&A, and expert network calls. This transforms the portal from a passive research artifact into an active diligence tool.

Structure:
- Hero with expand/collapse/print action buttons
- 4-5 question categories (varies by sector — Strategy / Capital Allocation / Competitive / Risk / Variant Perception is the default set)
- For M&A situations: Deal Execution / Synergy Capture / Litigation / Strategy / Variant Perception
- For alt asset managers: Platform / Capital Allocation / Competitive / Risk / Variant Perception
- Each question:
  - Numbered with priority tag (High / Medium / Standard)
  - Click-to-expand detail
  - "Why We're Asking" — rationale tied to the memo thesis
  - "Red-Flag Answer" — what a non-answer sounds like
- Print-optimized CSS — all questions expand on print for physical prep

Build pattern: see `references/page-structures.md` section "Page 6: Questions" and `examples/bx/bx-questions.ts` or `examples/kmb/kmb-questions.ts` for reference implementations.

**Navigation:** add `<a href="/lcs/{ticker}/questions.html">Questions</a>` to every other page's nav.

### Phase 3.5: Interactive Model Enhancements (v1.1+)

The interactive model page should include these features beyond the core slider architecture:

**Probability-Weighted Expected Value Panel**
- 4 probability sliders (Bull / Base / Street / Bear)
- Sum indicator (green when 100%, red otherwise)
- Table showing each scenario's fair value, return, and weighted PT contribution
- Expected Value row = Σ(probability × fair value)
- Uses the respective PRESET for each scenario's assumptions

**URL-Encoded Scenario Sharing**
- "Share This Scenario" button in hero
- Encodes all slider + probability state to a base64 JSON URL hash
- On page load: if `location.hash` present, decode and apply to sliders
- Copy-to-clipboard with visible confirmation toast

**PDF Export**
- "Export PDF" button triggers `window.print()`
- Print CSS hides nav, sidebar controls, and interactive elements
- Memo, questions, and model pages all support this

### Phase 4: Wire Routing & Deploy

See `references/deployment.md` for the full Cloudflare Worker setup.

Summary:
1. Add the 5 `bxIndexHTML` / `bxMemoHTML` / etc. imports to `src/index.ts`
2. Add 5 route handlers matching the path pattern `/lcs/<ticker>/` and `/lcs/<ticker>/<page>.html`
3. Deploy via `npx wrangler deploy`

### Phase 5: Verify

```bash
for page in "" "memo.html" "presentation.html" "model.html" "consensus.html" "questions.html"; do
  curl -s -o /dev/null -w "%{http_code}" "https://{DOMAIN}/lcs/{ticker}/${page}"
done
```

All 5 should return `200`. Then visually spot-check:
- Model page: no JS console errors, sliders work, charts render
- Memo: sidenotes visible on desktop
- Presentation: carousel navigates correctly

## Sector Detection

Before Phase 2, classify the company into a sector pattern:

| Sector | Key Tell | Model Template |
|--------|----------|----------------|
| Mega-Cap Tech/Cloud | Multi-segment (cloud + retail + ads) | AMZN pattern — multi-year, blended DCF + EV/EBITDA |
| Alt Asset Manager | FRE, DE, AUM disclosed | BX pattern — FRE/DE/AUM algorithm |
| M&A / Merger Situation | Announced deal, pending close | KMB/KVUE pattern — accretion model |
| Trucking/Transport | Operating ratio disclosed | KNX pattern — OR model |
| REIT | Cap rates, NAV disclosed | SLG pattern — NAV/cap rate model |
| Music/Media | Subscription revenue | UMG pattern — subscription growth |
| Industrial/Conglomerate | Multi-segment EBITDA | RRX pattern — segment EBITDA |
| Energy/Oilfield | FCF yield, reserves | BKR pattern — FCF yield model |
| SaaS/Software | ARR, NDR, Rule of 40 | SaaS pattern — ARR/NDR with Rule of 40 |
| Financials/Banks | NIM, ROE, book value | Banks pattern — NIM/ROE |
| Healthcare/Pharma | Pipeline probability | Pharma pattern — probability-adjusted NPV |
| Consumer/Retail | Same-store sales | Consumer pattern — SSS + margin |
| Default | Everything else | Generic EPS growth model |

See `references/sector-patterns.md` for detailed model specifications per sector.

## Quality Checklist

Before deployment, verify:

**Data Accuracy:**
- [ ] All historical financials match 10-K/10-Q (spot-check 5 numbers)
- [ ] Forward estimates labeled as `[Consensus]`, `[Sell-Side]`, or `[Estimated]`
- [ ] All management quotes have speaker attribution and source
- [ ] Rating bar totals match analyst count in consensus strip
- [ ] Consensus estimate ranges are internally consistent

**Model Functionality:**
- [ ] Model page: no JS console errors, all sliders functional
- [ ] All 4 presets (Bull/Base/Street/Bear) produce reasonable valuations
- [ ] DCF produces reasonable implied price (within 50% of current)
- [ ] SOTP equity stakes individually broken out with sliders (if applicable)
- [ ] Keyboard shortcuts (1/2/3/4/R) work
- [ ] Probability-weighted EV row in scenario table
- [ ] Charts render (if included)

**Anti-Hallucination:**
- [ ] Memo: 15+ source tags (`[10-K]`, `[Transcript]`, etc.) + methodology footnotes
- [ ] Consensus: data-source footnotes after every table + master disclaimer
- [ ] Index: title tooltips on all 7 metrics + hero badge
- [ ] Model: rationale tooltips on all 12 slider labels
- [ ] Deck: source lines on 8+ data-heavy slides
- [ ] Source attribution covers ALL 5 page types

**Completeness & UX:**
- [ ] Earnings setup box on landing page with next quarter estimates
- [ ] Memo has 8+ sidenotes, SCQA broken into sub-paragraphs
- [ ] Consensus has peer comp, forward estimate detail, management quotes, catalyst calendar
- [ ] OG meta tags + description + favicon on all pages
- [ ] Clickable brand linking to /lcs/ + "Last updated" timestamp in all footers
- [ ] Print CSS on memo
- [ ] Dark mode toggle on all pages with localStorage persistence
- [ ] Section navigation: memo TOC, consensus nav
- [ ] Dual PT badges on index hero: Street + LCS

**Accessibility & Design:**
- [ ] Skip-to-content link as first element after `<body>`
- [ ] `<main id="main-content">` landmark
- [ ] `aria-label` on primary `<nav>`, dark-mode toggle, model sliders, TOC, carousel arrows/dots
- [ ] Semantic H1 heading on every page
- [ ] Hover hint text on all tooltip-bearing pages (index, model, consensus)

**Technical:**
- [ ] No `${` template interpolation bugs in served HTML (watch for escaping backticks `\`` inside script tags)
- [ ] No unescaped single quotes in JS strings within template literal
- [ ] All nav links correct with proper active states
- [ ] Mobile responsive: tables scroll, metrics reflow, nav collapses
- [ ] Dark mode CSS covers all elements
- [ ] All 5 pages return HTTP 200

## Common Pitfalls to Avoid

1. **Back-loaded synergy curves for M&A situations.** Unless management has
   explicitly telegraphed a back-loaded ramp, most CPG/industrial deals in
   2020+ are front-loaded (25% / 65% / 90% / 100%). Check IR disclosures.

2. **Mixing up FRE and DE for alt asset managers.** FRE is fee-related
   earnings (subscription-like). DE is distributable earnings (includes
   realizations). Different growth rates, different multiples.

3. **Over-stating realization recovery.** For alt managers, model a
   *normalization* path, not a cycle-peak. Pre-pandemic BX mid-cycle
   realizations were $3.5-4B; post-drought recovery should get there
   over 2-3 years, not 1 quarter.

4. **Using the wrong sector template.** Applying an EPS-growth model to
   a REIT or an alt manager produces misleading valuations. Always detect
   sector first.

5. **Letting JS template literals break.** When building the interactive
   model HTML string, every backtick, `${`, and embedded quote needs careful
   escaping. Prefer `\\\`` and `\\${` when they appear inside inline scripts.

6. **Skipping the anti-hallucination tags.** The tags are not decorative —
   they are the audit trail. If you can't tag it, you shouldn't print it.

## Example Invocations

```
/stock-pitch:stock-pitch BX
→ Build BX (Blackstone) portal using alt asset manager template

/stock-pitch:stock-pitch KMB
→ Detects pending KVUE merger, switches to accretion/dilution template

/stock-pitch:stock-pitch SNOW
→ Detects SaaS, uses ARR/NDR/Rule of 40 template

/stock-pitch:stock-pitch SLG /path/to/barclays-report.pdf
→ Builds SLG (SL Green) as REIT with sell-side PDF enrichment
```

## Reference Examples

Complete reference implementations live in `examples/`:
- `examples/bx/` — Blackstone (alt asset manager template)
- `examples/kmb/` — Kimberly-Clark + Kenvue merger (accretion template)

Study these as patterns for new builds.
