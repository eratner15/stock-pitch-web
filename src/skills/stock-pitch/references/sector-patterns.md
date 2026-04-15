# Sector Patterns

Different businesses need different analytical frameworks. Detect the sector first, then apply the right pattern. This file documents each pattern's characteristic data structures, key metrics, and model logic.

## M&A / Merger Situations

**When to use:** Target company is involved in an announced merger or acquisition (either as acquirer or target) with pending close within 18 months.

**Key data to gather:**
- Deal consideration mix (cash / stock ratio, exchange ratio, per-share value)
- Enterprise value, EV/EBITDA multiple (LTM and with synergies)
- Pro-forma ownership split (acquirer % / target %)
- Disclosed synergy target (gross cost + revenue, reinvestment)
- Expected close date, regulatory status
- Shareholder vote outcomes
- New debt for cash consideration
- Combined-company leadership, HQ

**Model template: Accretion / Dilution**

Core inputs (sliders):
- Synergy capture rate (% of run-rate target)
- Synergy phasing (Yr 1 / Yr 2 / Yr 3 / Yr 4) — **front-loaded by default** (25% / 65% / 90% / 100%)
- Revenue dis-synergies (Yr 1 % of combined revenue)
- New debt blended cost
- Annual debt paydown
- Blended tax rate
- Acquirer standalone revenue growth
- Target standalone revenue growth
- Target P/E on pro-forma EPS
- WACC, terminal growth

Key outputs:
- Combined P&L through Year 4 (FY26E–FY29E)
- Accretion/dilution walk ($ and % vs acquirer standalone)
- Synergy realization schedule by year
- Leverage bridge (net debt / EBITDA by year)
- Sensitivity tables: synergy × debt cost → EPS; synergy × P/E → fair value

**Key narrative:**
- SCQA memo emphasizes "where the Street is wrong on synergy capture"
- Every $100M of realized net synergies should be translated to $X of per-share EPS impact (a rule of thumb)
- Bear case synergy realization (~50%) should still be neutral-to-slightly-accretive
- Highlight front-loaded vs back-loaded curve distinction

**Reference:** `examples/kmb/` (Kimberly-Clark + Kenvue merger)

---

## Alternative Asset Manager

**When to use:** Company discloses FRE (fee-related earnings), DE (distributable earnings), AUM (assets under management) as primary KPIs.

Examples: BX, APO, KKR, ARES, OWL, TPG, BAM

**Key data to gather:**
- Total AUM by segment (Real Estate, PE, Credit/Insurance, Multi-Asset + Infra)
- Fee-earning AUM (typically ~72% of total)
- Management fees by segment (annualized)
- Fee rate by segment (bps)
- Fee-related performance revenues
- FRE, FRE margin
- Net realizations (last 4-5 years to establish cycle position)
- Net accrued performance compensation (the "coiled spring")
- Distributable earnings, DE per share
- Perpetual-capital AUM (% of total)
- Dividend per share, payout ratio

**Model template: FRE / DE / AUM Algorithm**

Core inputs (sliders):
- AUM growth by segment (4 sliders: RE, PE, Credit, Multi-Asset)
- Blended management fee rate
- FRE margin (primary margin driver)
- Fee-related performance revenue growth
- Net realizations (base $ level)
- Realization YoY growth (cycle recovery pace)
- Target P/DE multiple
- Payout ratio
- WACC, terminal growth

Key outputs:
- AUM build by segment, FY25A through FY28E
- FRE + DE trajectory table
- Sensitivity: AUM growth × FRE margin → DE/share
- Sensitivity: DE/share × forward P/DE → fair value
- DCF cross-check (minimal net debt assumption)

**Key narrative:**
- Perpetual-capital flywheel (>40% of AUM being perpetual changes the multiple)
- Private wealth inflection ($70T+ TAM at ~3% penetration)
- Realization cycle setup (accrued carry pool sizing vs mid-cycle pace)
- Premium vs peers justified by credit underweight + FRE margin + distribution scale

**Reference:** `examples/bx/` (Blackstone)

---

## Trucking / Transportation

**When to use:** Company primarily reports operating ratio (OR = operating expense / revenue).

Examples: KNX, ODFL, XPO, SAIA, WERN, HTLD

**Key data to gather:**
- Truckload (TL) and LTL segment revenue
- Segment operating ratios
- Tractor count, intermodal revenue
- Contract vs spot rate mix
- Revenue per loaded mile
- FY25 revenue and adj EPS (which is typically cycle-trough)

**Model template: Operating Ratio Model**

Core inputs:
- TL contract rate inflection %
- TL volume growth
- LTL revenue CAGR
- TL operating ratio trajectory
- LTL operating ratio trajectory
- Fleet size / capex
- Target P/E on FY27E EPS
- WACC, terminal growth

Key outputs:
- TL revenue × OR = TL operating income
- LTL revenue × OR = LTL operating income
- Consolidated EPS recovery (often 5-10x from trough)
- Peer comp vs ODFL/XPO/SAIA

**Key narrative:**
- Freight cycle recovery (rates inflecting positive)
- LTL buildout / structural re-rating
- Cyclical trough valuation

**Reference:** `examples/knx-pattern.md` (descriptive only — see LCS codebase for KNX portal)

---

## REIT

**When to use:** Company structured as REIT with NAV / cap rate disclosures.

Examples: SLG, BXP, VNO, KIM, O, STAG, EXR

**Key data to gather:**
- Portfolio NAV by property type
- Implied cap rate
- AFFO per share
- Dividend coverage
- Lease rollover schedule
- Development pipeline
- Same-store NOI growth

**Model template: NAV / Cap Rate**

Core inputs:
- Office NOI growth (or primary property type)
- Retail NOI growth
- Cap rate for valuation (e.g., 6.5% vs 8% bear)
- Dev pipeline capitalization rate
- G&A growth
- AFFO margin
- Target P/AFFO

Key outputs:
- Property NOI × (1/cap rate) = implied gross asset value
- Less: mortgages + preferred + G&A = NAV
- NAV per share, premium/discount to current
- AFFO multiple cross-check

**Key narrative:**
- Cycle positioning (commercial RE trough)
- Dev pipeline returns
- Asset quality + lease duration

---

## SaaS / Software

**When to use:** Company reports ARR (annual recurring revenue) and NDR (net dollar retention).

Examples: SNOW, NET, DDOG, CRM, WDAY, NOW

**Key data to gather:**
- ARR (or equivalent), YoY growth
- Net dollar retention
- FCF margin
- Rule of 40 metric (revenue growth + FCF margin, target >40%)
- Billings growth
- Gross margin, magic number

**Model template: ARR / NDR Model**

Core inputs:
- New customer growth
- NDR (upsell / churn)
- Gross margin trajectory
- S&M leverage
- FCF margin expansion
- Target EV/ARR or EV/S
- WACC, terminal growth

Key outputs:
- ARR build with cohort analysis
- Revenue → FCF bridge
- Rule of 40 scorecard
- Sensitivity: NDR × multiple

**Key narrative:**
- Land and expand economics
- AI / vertical-specific TAM expansion
- Operating leverage pathway

---

## Financial Services / Banks

**When to use:** Company reports NIM (net interest margin), ROE, book value.

Examples: JPM, BAC, WFC, C, GS, MS

**Key data to gather:**
- NIM, net interest income
- Non-interest income mix
- Efficiency ratio
- ROE / ROTCE
- Tangible book value per share
- CET1 ratio
- Loan growth, deposit beta

**Model template: NIM / ROE Model**

Core inputs:
- NIM path
- Loan growth
- Deposit mix
- Fee income growth
- Credit losses (CECL reserve)
- Efficiency ratio
- Target P/TBV
- ROE

Key outputs:
- NIM × IEA = NII
- Plus fee income less expenses = pre-provision pretax
- Less credit losses = net income
- ROE and RoTCE ratios
- Book value accretion path

**Key narrative:**
- Rate cycle impact on NIM
- Credit normalization
- Capital return (buybacks + divs)

---

## Mega-Cap Tech / Cloud

**When to use:** Multi-segment tech with cloud infrastructure as primary driver.

Examples: AMZN, MSFT, GOOGL, META

**Model template:** Multi-segment with blended DCF + EV/EBITDA cross-check. See AMZN reference for depth — includes per-segment revenue/OI sliders, SOTP with broken-out equity stakes.

**Key narrative driver:** Cloud growth inflection, AI capex cycle, consumer business stability.

---

## Healthcare / Pharma

**When to use:** Pipeline-driven company with binary FDA / regulatory outcomes.

Examples: LLY, MRK, ABBV, GILD, BMY, REGN

**Model template: Probability-Adjusted NPV**

Core inputs:
- Pipeline asset probabilities (Phase 1/2/3/approval)
- Peak sales estimates per asset
- Base business revenue growth
- Patent cliff impact
- Operating leverage

Key outputs:
- Sum of probability-adjusted NPV of pipeline assets
- Plus base business DCF
- Total enterprise value

**Key narrative:**
- Catalyst calendar (readouts, approvals)
- Label expansion optionality
- LOE (loss of exclusivity) bridge

---

## Consumer / Retail

**When to use:** Company reports same-store sales / comparable sales as primary KPI.

**Model template:** Same-store sales × stores + margin expansion → operating income.

---

## Industrial / Conglomerate

**When to use:** Multi-segment industrial with distinct end-market exposures.

**Model template:** Segment EBITDA build — each segment has revenue × margin, summed to consolidated.

---

## Energy / Oilfield

**When to use:** FCF yield and reserves replacement are primary valuation drivers.

**Model template:** FCF yield model with oil/gas price sensitivity.

---

## Music / Media

**When to use:** Subscription-driven with ARPU × subscriber dynamics.

**Model template:** Subscribers × ARPU → revenue; margin leverage on platform.

---

## Default / Generic

**When no sector classification fits cleanly:**

**Model template: EPS Growth**

Core inputs:
- Revenue growth
- Operating margin
- Tax rate
- Share count
- Target P/E
- WACC, terminal growth

Key outputs:
- Revenue × margin = operating income
- Less interest and tax = net income
- Divided by shares = EPS
- EPS × target P/E = fair value
- DCF cross-check

---

## Sector Detection Logic

When starting a new build, follow this detection order:

1. **Is there an announced M&A deal?** → M&A / Merger pattern
2. **Does the 10-K disclose FRE or AUM?** → Alt Asset Manager pattern
3. **Is there an Operating Ratio?** → Trucking pattern
4. **Is the company structured as a REIT?** → REIT pattern
5. **Does the 10-K discuss ARR, NDR, Rule of 40?** → SaaS pattern
6. **Primary KPI is NIM or ROTCE?** → Financials pattern
7. **Product pipeline with FDA catalysts?** → Healthcare/Pharma pattern
8. **Same-store sales disclosure?** → Consumer/Retail pattern
9. **Multi-segment industrial?** → Industrial pattern
10. **Oil/gas exposure?** → Energy pattern
11. **Subscribers × ARPU driver?** → Music/Media pattern
12. **Otherwise:** Default / Generic EPS pattern

When in doubt, spend 5 minutes reading the MD&A section of the 10-K — the company's own framing usually signals which pattern is right.
