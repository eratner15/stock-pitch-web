# Page Structures

Each of the 5 pages has a specific anatomy. Follow these structures precisely — deviating creates inconsistency across the portal.

## Shared Structure (All Pages)

```
<!DOCTYPE html>
<html>
<head>
  — Meta tags (description, OG title/description, favicon)
  — Fonts (Inter, Merriweather for memo, JetBrains Mono)
  — Inline CSS block with design system + page-specific styles
</head>
<body>
  — Skip-to-content link (first element)
  — Fixed nav with brand, links (5 pages), dark toggle, ticker display
  — <main id="main-content"> wrapping content
  — Footer with attribution, sources, last-updated timestamp
  — Inline script for dark-mode toggle + any page-specific JS
</body>
</html>
```

## Page 1: Index (Landing)

```
[Nav]
[Hero]
  - Eyebrow: "NYSE · Sector · Setup Descriptor"
  - H1 with one word/phrase gold-highlighted
  - Subtitle (2 sentences, thesis essence)
  - Dual PT badges: Street PT + LCS PT
[Metrics Bar — floats up via negative margin]
  - 7 metrics: Price, Mkt Cap, 2 fundamental, 2 financial, 1 forward estimate
  - "Hover any metric for data source" hint
[BLUF Section — surface background]
  - 3 paragraphs, 150-200 words each
  - Every claim has inline [tag] source attribution
  - Bold leads on key phrases
[Section: Data-Rich Block]
  - Sector-appropriate: AUM grid (alt mgr), Deal snapshot (M&A), Segment table, etc.
  - Often includes navy box with trajectory table
[Section: Investment Thesis — 3 pillars]
  - 3 cards with colored top borders (forest, steel, gold)
  - Each: number, h3, 3-4 sentence para, thesis-stat badge
[Section: Earnings Setup Box — navy]
  - 4-cell grid with key estimates
  - 2-card "what to watch" vs "risks into print"
[Section: Research Portal — module grid]
  - 2x2 grid of cards linking to other 4 pages
[Section: Sell-Side Views — 3 quotes]
  - Usually on surface background
  - Firm name, rating, PT, short quote, analyst attribution
[Footer]
```

## Page 2: Memo (Investment Memo)

```
[Nav]
[Memo Header]
  - Eyebrow
  - Merriweather H1 (can be long, e.g. "Underwriting the X at a Y Discount")
  - Meta row: Ticker, Price, Rating, PT, Horizon, Analyst
  - 5-cell rating strip (Deal EV / Syn / Combined Rev / FY27E / FY29E for M&A;
    Total AUM / FRE / DE for alt mgr; etc.)
[TOC — bordered surface box]
  - 10-11 anchor links to sections below
[Article — max-width:720px for reading length]
  - H2: "Situation: ..." (SCQA Situation)
  - H2: "Complication: ..." with H3 sub-points
  - H2: "The Central Question" (1 paragraph)
  - H2: "Our Answer: ..." (summary of thesis + rating + PT)
  - H2: Key analytical sections (Synergy Decomposition, Platform Economics,
    Realization Setup, etc. — varies by sector/situation)
  - H2: "Valuation Framework" with multi-method table
  - H2: "Risk Assessment" — 4-6 risks, each with impact/probability + mitigant
  - H2: "Catalysts" — timeline of upcoming events
[Sources & Methodology Box — before footer]
  - 3-column grid: Primary Filings / IR & Transcripts / Market Data
[Footer]
```

**Sidenote pattern:**

```html
<aside class="sidenote">Short factual observation with source tag. [IR]</aside>
```

On desktop these float into right margin; on mobile they become inline surface boxes. Minimum 8 sidenotes throughout the memo.

**Source tag pattern (inline):**

```html
<p>Revenue grew 12% to $8.0B <span class="tag">10-K</span></p>
```

Rendered as small gold pill inline with text.

## Page 3: Presentation (Slide Deck)

```
[Nav Bar — dark background]
  - Brand, nav links, slide counter
[Deck Container — dark page background]
  [Slide 1: Cover — gradient navy]
    - Eyebrow, H1, subtitle, 2 badges, 3 cover stats
  [Slide 2: Company/Deal Snapshot]
    - 4-cell stat grid
    - 2-column: "Key Milestones" / "Leadership"
  [Slide 3: Business Overview]
    - Segment or AUM table
    - Key insight paragraph
  [Slide 4: Three Pillars — thesis pillars]
  [Slide 5: Financials — 3 forward years of P&L or KPI table]
  [Slide 6: Synergy Phasing (M&A) or TAM Analysis (alt mgr) or Volume Algorithm (trucking)]
  [Slide 7: Forward Trajectory — detailed P&L or DE table]
  [Slide 8: Accretion Walk (M&A) or Realization Setup (alt mgr)]
  [Slide 9: Balance Sheet / Leverage (M&A) or Peer Comp]
  [Slide 10: Valuation Framework — 3 methods grid]
  [Slide 11: LCS Variant Perception — Street vs LCS table]
  [Slide 12: Risk Assessment — risk matrix table]
  [Slide 13: Catalyst Calendar]
  [Slide 14: Recommendation — rating + PT + total return bridge]
[Floating Navigation]
  - Prev/Next arrows (bottom center)
  - Dot indicators (bottom right)
[Keyboard: ArrowRight / ArrowLeft]
```

**Slide size:** max-width:1100px, min-height:620px, padding:48px 56px.

## Page 4: Interactive Model

```
[Nav]
[Hero]
  - H1: "Company Interactive Model"
  - Subtitle: "AUM / FRE / DE algorithm · inflow & margin sliders · FY26E–FY28E"
  - Keyboard shortcut hint: "Presets: 1 Bull 2 Base 3 Street 4 Bear R Reset"
[Main Grid — 2-column desktop, 1-column tablet+mobile]
  [Left Sidebar — sticky controls]
    [Preset Box — 4 buttons]
    [Control Box 1 — AUM / Growth assumptions]
    [Control Box 2 — Margins / Fees]
    [Control Box 3 — Realization / Cycle-specific]
    [Control Box 4 — Valuation]
    Each box has H3 label + 3-5 sliders with:
      - Label with border-bottom dotted (cursor:help)
      - Right-aligned gold value in JetBrains Mono
      - Range input styled with gold thumb
      - title attribute on each label explaining rationale
  [Content Column]
    [Value Cards — 4-up]
      - Key forward metrics (e.g., FY27E EPS, LCS Fair Value, 2-Yr IRR)
      - Color-coded (green/gold/red based on state)
    [Panel: Financial Bridge Table]
      - 5-year projections, sector-appropriate lines
      - Caption with methodology
    [Panel: Accretion Walk (M&A) or DE Build (alt mgr)]
    [Panel: Synergy Schedule / AUM Build]
    [Panel: Sensitivity Table 1 — primary variable × debt/margin]
    [Panel: Sensitivity Table 2 — primary variable × multiple]
    [Panel: Leverage Bridge / DCF Cross-Check]
[Footer]
```

**Model JS structure:**

```js
const PRESETS = {
  bull:   {/* slider values */},
  base:   {/* slider values */},
  street: {/* slider values */},
  bear:   {/* slider values */},
};

function getState() { /* read all slider values */ }
function applyPreset(name) { /* set sliders + mark preset active */ }
function computeModel(state) {
  /* pure function: takes state, returns model outputs */
  /* split into: baseline calcs, forward projections, derived metrics */
}
function update() {
  /* read state, compute, update all DOM */
  /* update slider display values, value cards, all tables, sensitivities */
}

/* Wire all sliders to call update() + clear preset highlighting */
/* Wire keyboard shortcuts: 1/2/3/4/R */
/* Call update() on load */
```

## Page 5: Consensus

```
[Nav]
[Hero]
  - H1: "Consensus View & LCS Variant Perception"
  - Subtitle
  - Consensus strip (5 cells: Rating, Mean PT, High/Low, Analyst Count, LCS PT)
  - Rating distribution bar (segmented flex with Strong Buy / Buy / Hold / Sell)
[Section: Analyst Coverage Detail]
  - Table with 10 analysts: Firm, Analyst, Rating, PT, Upside, Key View
  - Caption with source attribution
[Section: Peer Comparison — surface background]
  - Table comparing target vs 5-6 peers
  - Target row highlighted (gold background)
  - Include peer median row
  - Caption explaining premium/discount
[Section: Forward Estimates Detail]
  - Table: Revenue, EPS, margins, FCF by year
  - Both Consensus and LCS Estimate rows
  - Delta row showing LCS vs Street
[Section: "Where the Street Is Right / Wrong" — surface background]
  - 4 cards in 2x2 grid: 2 "Street Gets This Right" (green tag) + 2 "LCS Variant Perception" (red tag)
  - Navy "The LCS View" box with specific numeric divergence explanation
[Section: Management Quotes]
  - 3 quotes with gold left border, attribution
[Section: Catalyst Calendar — surface background]
  - Table: Date, Event, Type, Watch
[Footer]
```

## Page 6: Questions for Management

```
[Nav]
[Hero]
  - Eyebrow: "Diligence Toolkit · Management Questions"
  - H1: "20 Questions for {Company} Management"
  - Subtitle explaining purpose
  - Action buttons: Expand All / Collapse All / Export PDF
[Intro Box — surface with gold left border]
  - How to use this page
  - Emphasis on priority-flagged must-asks
[Category Sections — 4-5 categories]
  Each category:
    - Colored bar indicator (forest/steel/gold/red/navy)
    - Category title + question count
    - 3-5 question cards
  Question card structure:
    - Number (01-20)
    - Question text (bold, 15px)
    - Priority tag (High / Medium / Standard)
    - Click-to-expand detail:
      - Why We're Asking (rationale tied to thesis)
      - Red-Flag Answer (what a non-answer sounds like)
[Footer]
```

### Category Presets by Sector

**Generic / Default:**
1. Strategy (4 questions)
2. Capital Allocation (4 questions)
3. Competitive Dynamics (4 questions)
4. Risk & Downside (5 questions)
5. Variant Perception (3 questions)

**M&A / Merger:**
1. Deal Execution & Close (4 questions)
2. Synergy Capture (5 questions)
3. Litigation / Regulatory (3 questions — Tylenol / antitrust / FDA / etc.)
4. Strategy & Portfolio (5 questions)
5. Variant Perception (3 questions)

**Alt Asset Manager:**
1. Strategy & Platform (4 questions)
2. Capital Allocation (4 questions)
3. Competitive Dynamics (4 questions)
4. Risk & Downside Scenarios (5 questions)
5. Variant Perception (3 questions)

**Trucking / Transport:**
1. Cycle Positioning (4 questions)
2. Capital Allocation / Fleet (4 questions)
3. Competitive (LTL vs TL)
4. Fuel / Rate / Labor Risk (4 questions)
5. Variant Perception (3 questions)

### Priority Tagging

- **High Priority (red)** — must-ask if you have only 3-5 questions in a meeting. These are the ones where a non-answer meaningfully changes the thesis.
- **Medium (gold)** — important for fuller conversations or follow-ups.
- **Standard (steel)** — nice-to-have color; typical sell-side quality.

### Interaction Pattern

```js
function toggleQ(el){el.parentElement.classList.toggle('expanded')}
function expandAll(){document.querySelectorAll('.question').forEach(q=>q.classList.add('expanded'))}
function collapseAll(){document.querySelectorAll('.question').forEach(q=>q.classList.remove('expanded'))}
```

On print: all `.q-detail` are forced `display:block` so a physical printout brings all rationale with it.

## Footer (All Pages)

```html
<footer>
  <div class="footer-line"></div>
  <p>Levin Capital Strategies &bull; {Ticker} {Context} Research Portal</p>
  <p>Sources: {Key sources listed}. For internal use only.</p>
  <p style="margin-top:8px;font-size:10px;color:var(--text-muted);opacity:0.5">Last updated: {Date}</p>
</footer>
```

```css
footer{padding:40px 0;text-align:center;border-top:1px solid var(--border-light)}
.footer-line{width:40px;height:2px;background:var(--gold);margin:0 auto 16px}
footer p{font-size:11px;color:var(--text-muted);line-height:1.8}
```
