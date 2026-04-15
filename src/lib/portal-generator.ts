/**
 * Portal generator — chains Workers AI calls against the stock-pitch skill
 * to produce a 6-page institutional research portal from a single ticker.
 *
 * Adaptation of skills/stock-pitch/SKILL.md for a Worker runtime:
 *   - WebFetch/WebSearch (Claude Code tools) → server-side fetch() against
 *     EDGAR + Yahoo
 *   - Single-shot Claude invocation → chain of smaller Workers AI calls,
 *     one logical section per call, parallelized per page
 *
 * Phases:
 *   1. Data collection (deterministic, ~15s) — EDGAR 10-K + 10-Q + Yahoo
 *   2. AI analysis (chained WAI, ~60-120s) — thesis + sections
 *   3. HTML assembly (deterministic) — portal-templates.ts
 *   4. Persist (KV) — each page HTML under portal:{ticker}:{page}
 *
 * MVP: memo + index + consensus pages (v1). Model/deck/questions come next.
 */

import skillMarkdown from '../skills/stock-pitch/SKILL.md';

import { fetchPrice, type PriceQuote } from './prices';
import {
  getCik,
  fetchLatest10K,
  fetchLatest10Q,
} from './edgar';

// Primary writer — Llama 3.3 70B on Workers AI. NOT a reasoning model,
// so output lands in message.content directly. Gemma 4 26B IS a reasoning
// model (output goes to message.reasoning, content stays null) which is
// why the first JSON attempt failed silently. Llama 3.3 70B fp8-fast is
// the right fit: good long-form writing + clean instruct output.
const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const FAST_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// ---------------------------------------------------------------------------
// Research payload — what the writer sees
// ---------------------------------------------------------------------------

export interface Research {
  ticker: string;
  company: string;
  cik: string | null;
  quote: PriceQuote | null;
  filing_10k_url: string | null;
  filing_10k_date: string | null;
  filing_10q_url: string | null;
  filing_10q_date: string | null;
  mda_excerpt: string;       // capped for prompt size
  risks_excerpt: string;
  tenq_excerpt: string;
  thesis: string | null;     // user-provided if any
  direction: 'long' | 'short' | null;
  price_target: number | null;
}

export async function collectResearch(args: {
  ticker: string;
  thesis?: string | null;
  direction?: 'long' | 'short' | null;
  price_target?: number | null;
}): Promise<Research> {
  const t = args.ticker.toUpperCase();

  // Parallel data pulls
  const [cik, quote, tenK, tenQ] = await Promise.all([
    getCik(t),
    fetchPrice(t),
    fetchLatest10K(t),
    fetchLatest10Q(t),
  ]);

  return {
    ticker: t,
    company: quote?.company ?? cik?.name ?? t,
    cik: cik?.cik ?? null,
    quote,
    filing_10k_url: tenK.filing?.documentUrl ?? null,
    filing_10k_date: tenK.filing?.filingDate ?? null,
    filing_10q_url: tenQ.filing?.documentUrl ?? null,
    filing_10q_date: tenQ.filing?.filingDate ?? null,
    // Aggressive cap: ~10K chars total excerpt. Workers AI models throttle
    // heavily on large contexts; tighter is faster and the model only
    // needs signal, not full filings.
    // Big excerpts — AMZN-caliber memos cite dense specifics. 10-K MD&A is
    // the main signal source; Item 1A Risk Factors feeds the risks section;
    // 10-Q captures fresh guidance + quarterly commentary.
    mda_excerpt: tenK.mda.slice(0, 55000),
    risks_excerpt: tenK.risks.slice(0, 25000),
    tenq_excerpt: tenQ.text.slice(0, 15000),
    thesis: args.thesis ?? null,
    direction: args.direction ?? null,
    price_target: args.price_target ?? null,
  };
}

// ---------------------------------------------------------------------------
// AI call helper — Workers AI dispatch with OpenAI-compatible response shape
// ---------------------------------------------------------------------------

/**
 * Coerce Workers AI response content into a flat string. Handles string,
 * array-of-content-blocks (Anthropic style), {parts:[{text}]} (Gemini style),
 * and deeply nested objects. Returns '' if nothing extractable.
 */
function extractAiText(raw: any): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw.map(extractAiText).filter(Boolean).join('\n');
  }
  if (typeof raw === 'object') {
    if (typeof raw.text === 'string') return raw.text;
    if (typeof raw.content === 'string') return raw.content;
    if (Array.isArray(raw.parts)) return raw.parts.map(extractAiText).filter(Boolean).join('\n');
    if (Array.isArray(raw.content)) return raw.content.map(extractAiText).filter(Boolean).join('\n');
    // Last resort: stringify
    try { return JSON.stringify(raw); } catch { return ''; }
  }
  return String(raw);
}

async function runModel(
  ai: any,
  model: string,
  system: string,
  user: string,
  opts: { max_tokens?: number; temperature?: number; timeoutMs?: number } = {}
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const started = Date.now();
  try {
    const runPromise = ai.run(model, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: opts.max_tokens ?? 2048,
      temperature: opts.temperature ?? 0.5,
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const res = await Promise.race([runPromise, timeout]);
    const ms = Date.now() - started;
    if (!res) {
      console.warn(`[portal] model ${model} TIMEOUT after ${ms}ms / ${timeoutMs}ms`);
      return '';
    }
    const asAny = res as any;
    const msg = asAny?.choices?.[0]?.message;
    // Workers AI models return content in several shapes:
    //   content: "string"                        (most instruct models)
    //   content: null, reasoning: "string"       (Gemma 4, reasoning models)
    //   content: [{type:'text', text:'...'}]     (Anthropic-compatible)
    //   content: {parts:[{text:'...'}]}          (Gemini-compatible)
    //   response: "string"                       (legacy Workers AI format)
    const text: string = extractAiText(msg?.content) ||
      extractAiText(msg?.reasoning) ||
      extractAiText(asAny?.response) ||
      '';
    if (!text && ms < 5000) {
      // Very fast return with no text usually means an upstream error
      console.warn(`[portal] ${model} fast-empty. msg=${JSON.stringify(msg).slice(0, 500)}`);
    }
    if (!text) {
      console.warn(`[portal] model ${model} EMPTY response in ${ms}ms. Keys: ${Object.keys(asAny || {}).join(',')}. Sample: ${JSON.stringify(asAny).slice(0, 400)}`);
    } else {
      console.log(`[portal] model ${model} OK in ${ms}ms, ${text.length} chars`);
    }
    return text.trim();
  } catch (err) {
    const ms = Date.now() - started;
    console.error(`[portal] model ${model} THREW after ${ms}ms:`, String(err).slice(0, 300));
    return '';
  }
}

// ---------------------------------------------------------------------------
// Per-section writers — each call is focused, short, and verifiable.
// ---------------------------------------------------------------------------

/**
 * Shared voice prompt — enforced on every call so the whole portal reads
 * like one analyst wrote it.
 */
const VOICE_SYSTEM = `You are a senior sell-side equity research analyst covering this name for a decade at Levin Capital Strategies. Voice: direct, specific, analytical, institutional prose. Zero hype. Zero exclamation points. Zero hedge-words like "could potentially" or "may possibly". Write with conviction backed by specific data.

EVERY financial figure MUST carry a bracketed source tag:
  [10-K] — SEC annual filing     [10-Q] — quarterly filing
  [Transcript] — earnings call   [IR] — investor relations
  [Market] — live market data    [Consensus] — analyst consensus
  [Computed] — derived from the above, method named inline
  [Estimated] — our estimate with methodology shown

RULES:
- Target word counts are firm — hit them, don't go under.
- Include SPECIFIC numbers: dollar amounts, percentages, ratios, dates. At least 6 specific data points per 300 words.
- Use SPECIFIC names: CEOs, CFOs, key products, named competitors, specific analysts or banks when relevant.
- Prefer concrete nouns: "Trainium chips" not "AI accelerators". "Robotaxi event Oct 2024" not "recent announcement".
- If you don't know a number, write "not disclosed" or "pending" — NEVER invent.
- You may emit Tufte-style sidenotes with marker [[SIDENOTE: fact or callout]]. Use 1-2 per section for non-obvious specifics worth spotlighting.
- NO preamble, NO meta-commentary, NO "In summary" endings. Just the analysis.`;

export interface PortalContent {
  tagline: string;                                 // one-line pitch
  bluf: string;                                    // 3-sentence top-of-memo answer

  // 10-section memo body — each section is its own rich paragraph block
  executiveSummary: string;                        // 300-400 words
  businessOverview: string;                        // 400-500 words
  thesisSituation: string;                         // 300-400 words
  thesisComplication: string;                      // 300-400 words
  supportingPoint1: { heading: string; body: string };  // 800-1000 word deep dive on bull #1
  supportingPoint2: { heading: string; body: string };  // 800-1000 word deep dive on bull #2
  supportingPoint3: { heading: string; body: string };  // 800-1000 word deep dive on bull #3
  sotpSection: { heading: string; body: string };       // 800-1000 word SOTP / hidden-value
  mgmtSection: { heading: string; body: string };       // 600-800 word management + capital allocation
  competitiveSection: { heading: string; body: string };// 600-800 word competitive landscape
  financialBridge: string;                              // 600-800 word revenue & earnings bridge
  keyRisks: string;                                     // 600-800 words, multi-risk
  valuationSection: string;                             // 700-900 words, method + multiples
  priceTargetSection: string;                           // 500-700 words, upside/downside math
  catalystsSection: string;                             // 500-700 words, timeline

  // Flat arrays still used by bulls/bears card + diligence block
  bullPoints: string[];
  bearPoints: string[];
  diligenceQuestions: Array<{ q: string; rationale: string }>;

  // Tufte sidenotes — rendered as margin callouts
  sidenotes: string[];

  // Model page
  financials: {
    historical: Array<{ year: string; revenue: string; operatingIncome: string; eps: string }>;
    projected: Array<{ year: string; revenue: string; ebitdaMargin: string; eps: string }>;
    keyMetrics: Array<{ label: string; value: string; source: string }>;
    dcfNarrative: string;
  };

  // Consensus page
  consensus: {
    streetView: string;
    peerTickers: string[];
    peerNote: string;
    ourPt: string;
    ptMethodology: string;
  };

  // Deck page
  deckSlides: Array<{ title: string; bullets: string[]; speakerNote: string }>;
}

export async function writePortalContent(
  ai: any,
  r: Research
): Promise<PortalContent> {
  // Compact research card each call can quote from
  const researchCard = `
TICKER: ${r.ticker}
COMPANY: ${r.company}
CURRENT PRICE: ${r.quote ? `$${r.quote.price.toFixed(2)}` : 'unknown'}
AS OF: ${r.quote?.as_of ?? 'n/a'}
USER THESIS (optional): ${r.thesis ?? '(none — form your own)'}
USER DIRECTION: ${r.direction ?? '(none)'}
USER PRICE TARGET: ${r.price_target != null ? `$${r.price_target.toFixed(2)}` : '(none)'}
SEC FILINGS:
- Latest 10-K filed ${r.filing_10k_date ?? 'unknown'}: ${r.filing_10k_url ?? '(none)'}
- Latest 10-Q filed ${r.filing_10q_date ?? 'unknown'}: ${r.filing_10q_url ?? '(none)'}

--- 10-K MD&A EXCERPT ---
${r.mda_excerpt || '(not available)'}

--- 10-K RISK FACTORS EXCERPT ---
${r.risks_excerpt || '(not available)'}

--- 10-Q EXCERPT ---
${r.tenq_excerpt || '(not available)'}
`.trim();

  // Split into 5 sequential JSON calls. Each is small enough for Gemma
  // to complete reliably in <15s. Total ~60s for the whole portal.
  const sysJson = (schemaHint: string) => `${VOICE_SYSTEM}

Return ONE JSON object, nothing else — no preamble, no markdown fence.
Schema:
${schemaHint}

Every financial number MUST include a source tag like [10-K]. Report revenues in $M. If a number isn't disclosed, use "n.d." — NEVER invent.`;

  const userBase = `Ticker: ${r.ticker}
Company: ${r.company}
Research card:
${researchCard}`;

  console.log(`[portal][${r.ticker}] deep generation start. mda=${r.mda_excerpt.length} risks=${r.risks_excerpt.length} 10q=${r.tenq_excerpt.length}`);

  // SPLIT Call A into many smaller calls after iter1 showed the single big
  // JSON was truncating 70% of its sections. Now each prose section is its
  // own plain-markdown call. Only tagline+bluf+bullets stays as JSON (small).
  const batch1 = Promise.all([
    // Small JSON for thin structured data (tagline, bluf, bullet arrays)
    runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "tagline": "one-sentence pitch under 20 words, no period, specific claim",
  "bluf": "4-5 sentence top-of-memo answer stating the call, PT with upside %, primary bull driver, primary risk, catalyst timeline. Every number tagged.",
  "bullPoints": ["6 bullets each 22-32 words citing a specific number from 10-K"],
  "bearPoints": ["4 bullets each 22-32 words citing a specific risk from Item 1A"]
}`),
    `Produce the THESIS SPINE JSON for ${r.ticker} — tagline, BLUF, bulls, bears. Concise and specific.\n\n${userBase}`,
    { max_tokens: 2000, temperature: 0.5, timeoutMs: 50_000 }
  ),
    // Plain markdown for each prose section
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT: 500-600 words of executive-summary prose. No heading. 4+ specific dollar amounts, 3+ growth rates, 2+ specific dates. 2 sidenote markers [[SIDENOTE: ...]]. Dense source tags.`,
      `Write the EXECUTIVE SUMMARY for ${r.ticker}. Setup → mispricing → PT → catalyst timeline. 500-600 words.\n\n${userBase}`,
      { max_tokens: 2200, temperature: 0.5, timeoutMs: 65_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT: **write 800-1000 words — do NOT stop before 800 words**. No heading. Five paragraphs minimum:
  P1: What the business does + total revenue + employee count + geographic footprint
  P2: Segment 1 — revenue, op margin, growth rate, key products, customer concentration
  P3: Segment 2 — same structure
  P4: Segment 3 (or geographic split if only 2 segments) — same structure
  P5: One non-obvious structural feature the market doesn't discuss + why it matters
3 sidenotes [[SIDENOTE: ...]]. 10+ source tags. Every dollar carries [10-K].`,
      `Write the BUSINESS OVERVIEW for ${r.ticker}. 800-1000 words in 5 paragraphs.\n\n${userBase}`,
      { max_tokens: 3500, temperature: 0.5, timeoutMs: 75_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT: 500-600 words on what the MARKET currently prices. No heading. Cover: consensus EPS path year-by-year, current P/E or EV/EBITDA or EV/Sales, stock performance 1Y/3Y/5Y, analyst rating mix (Buy/Hold/Sell count), narrative the Street has settled on. Tag [Consensus]/[Market]/[Estimated]. 1-2 sidenotes.`,
      `Write THE SITUATION section for ${r.ticker}.\n\n${userBase}`,
      { max_tokens: 2200, temperature: 0.5, timeoutMs: 65_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT: 500-600 words on what's MISPRICED. No heading. Specific numerical gap: consensus FY26E EPS X vs our Y. Reference specific 10-K material the market is discounting (guidance commentary, segment disclosures, capex trajectory). 2 sidenotes.`,
      `Write THE COMPLICATION section for ${r.ticker}.\n\n${userBase}`,
      { max_tokens: 2200, temperature: 0.5, timeoutMs: 65_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT: 700-900 words of valuation analysis. No heading. Name method (SOTP / DCF / multiple / NAV). Show math end-to-end: assumptions → multiple → per-share value. If DCF, state WACC (risk-free, ERP, beta) + terminal growth. Compare to 5Y historical trading range. 2 sidenotes.`,
      `Write the VALUATION section for ${r.ticker}. Current price ${r.quote ? '$'+r.quote.price.toFixed(2) : 'n/a'}. 700-900 words.\n\n${userBase}`,
      { max_tokens: 3200, temperature: 0.5, timeoutMs: 70_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT: 500-700 words. No heading. State PT explicitly. Show upside/downside vs current. Three scenarios — Base (60%), Bull (25%), Bear (15%) — each with specific price, driver, EPS assumption, multiple. Probability-weighted EV at the end.`,
      `Write the PRICE TARGET SECTION for ${r.ticker} with three scenarios. Current price ${r.quote ? '$'+r.quote.price.toFixed(2) : 'n/a'}.\n\n${userBase}`,
      { max_tokens: 2400, temperature: 0.5, timeoutMs: 65_000 }
    ),
  ]);
  const batch2 = Promise.all([
    // ---- Call A2: Supporting point #1 (plain markdown output) ----
    runModel(
    ai, PRIMARY_MODEL,
    VOICE_SYSTEM + `

OUTPUT FORMAT: FIRST line is "# " followed by an 8-12 word argumentative H2 headline. Remaining content is 800-1000 words of prose in 4-5 paragraphs. Every financial number carries a source tag. 15+ source tags total. 3 sidenote markers [[SIDENOTE: ...]]. No preamble, no meta.`,
    `Write the STRONGEST bull-case deep-dive for ${r.ticker}. Pick the most material structural advantage in the 10-K MD&A. Cover: 3-year revenue trajectory with growth rates, margin path with percentages, named products/customers/partnerships, competitive positioning with named rivals, guidance quotes, and capex/R&D.\n\n${userBase}`,
    { max_tokens: 3500, temperature: 0.55, timeoutMs: 75_000 }
  ),
    // ---- Call A3: Supporting point #2 (plain markdown output) ----
    runModel(
    ai, PRIMARY_MODEL,
    VOICE_SYSTEM + `

OUTPUT FORMAT: FIRST line is "# " + 8-12 word H2. Then **800-1000 words minimum — do not stop before 800 words**. Structure: 5 paragraphs each ~180 words. 20+ source tags. 3 sidenote markers [[SIDENOTE: ...]]. No preamble, no meta, no "In conclusion".`,
    `Write the SECOND-STRONGEST bull deep-dive for ${r.ticker}. ORTHOGONAL to the first deep dive (different axis). Minimum 800 words — keep writing until you hit 800. Do not summarize or stop early.\n\n${userBase}`,
    { max_tokens: 3800, temperature: 0.55, timeoutMs: 80_000 }
  ),
    // ---- Call A4: Risks (plain markdown) ----
    runModel(
    ai, PRIMARY_MODEL,
    VOICE_SYSTEM + `

OUTPUT FORMAT: 700-900 words of prose covering 4-5 specific risks. Each risk is a paragraph starting with a **bold heading**. Include: probability (low/medium/high), magnitude (EPS hit or multiple compression), warning signs, historical precedent. 2 sidenotes [[SIDENOTE: ...]]. No preamble.`,
    `Write the KEY RISKS section for ${r.ticker}. 4-5 specific risks from Item 1A. 700-900 words.\n\n${userBase}`,
    { max_tokens: 2800, temperature: 0.5, timeoutMs: 70_000 }
  ),
    // ---- Call A4b: Catalysts (plain markdown) ----
    runModel(
    ai, PRIMARY_MODEL,
    VOICE_SYSTEM + `

OUTPUT FORMAT: 600-800 words of prose listing 5-7 time-bound catalysts over the next 12-24 months. Each catalyst is a paragraph starting with a **bold date+event heading** like "**Q1 FY26 earnings · February 2026**". Include: what the event is, how it moves the stock (price delta), Street consensus vs our view, what would be a beat vs miss. 1-2 sidenotes [[SIDENOTE: ...]]. No preamble.`,
    `Write the CATALYSTS section for ${r.ticker}. 5-7 time-bound events, each with specific date.\n\n${userBase}`,
    { max_tokens: 2400, temperature: 0.5, timeoutMs: 70_000 }
  ),
    // ---- Call A5: Third supporting deep dive (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT FORMAT: FIRST line is "# " + 8-12 word H2. Then **800-1000 words minimum — do not stop before 800 words**. 5 paragraphs ~180 words each. 20+ source tags. 3 sidenotes [[SIDENOTE: ...]]. No preamble.`,
      `Write a THIRD bull deep-dive for ${r.ticker}. Orthogonal to the first two (pick: international expansion, margin inflection, capex cycle, capital return, product cycle, regulatory tailwind, pricing power, or unit economics at scale). Minimum 800 words — keep writing.\n\n${userBase}`,
      { max_tokens: 3800, temperature: 0.55, timeoutMs: 80_000 }
    ),
    // ---- Call A6: SOTP / Hidden Value (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT FORMAT: FIRST line is "# " + 8-12 word H2. Then 800-1000 words of prose. Table-in-prose: break out each segment/asset, estimate revenue and EBITDA [10-K], apply a peer multiple (cite the peer), arrive at a value [Computed]. Sum to get implied EV. Compare to current mkt cap. Flag hidden assets. 3 sidenotes.`,
      `Sum-of-parts / hidden value deep-dive for ${r.ticker}. Segment-by-segment math. 800-1000 words.\n\n${userBase}`,
      { max_tokens: 3500, temperature: 0.5, timeoutMs: 75_000 }
    ),
    // ---- Call A7: Management (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT FORMAT: FIRST line is "# " + 10-12 word H2 on management + capital allocation. Then 700-900 words of prose. Name CEO, CFO, tenure, prior roles. Cite buybacks ($ amounts + share count reductions over 3-5 years), dividends initiated/raised, major M&A (names + prices + IRR), capex trajectory. Compare capital return as % of FCF to peers. Named past decisions that created or destroyed value. 2 sidenotes [[SIDENOTE: ...]]. No preamble.`,
      `Management + capital allocation deep-dive for ${r.ticker}. 700-900 words. Name names and cite dollars.\n\n${userBase}`,
      { max_tokens: 2800, temperature: 0.5, timeoutMs: 70_000 }
    ),
    // ---- Call A7b: Revenue & Earnings Bridge (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT FORMAT: 700-900 words of prose, no heading. Walk from last-reported revenue → next 3-year revenue, decomposing by segment growth rates (organic vs acquired). Then walk from revenue → operating income (margin assumptions stated) → EPS (share count + tax rate stated). Include a Street-consensus vs our-estimates comparison. 2 sidenotes [[SIDENOTE: ...]]. Dense [10-K]/[Estimated] tags. No preamble.`,
      `Revenue & earnings bridge for ${r.ticker}. Walk forward 3 years with segment decomposition.\n\n${userBase}`,
      { max_tokens: 2800, temperature: 0.4, timeoutMs: 70_000 }
    ),
    // ---- Call A8: Competitive Landscape (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      VOICE_SYSTEM + `

OUTPUT FORMAT: FIRST line is "# " + 10-12 word H2 on competitive positioning. Then 700-900 words. Name 3-5 direct competitors, give each ~100 words on scale, margin, share dynamics. Explain ${r.ticker}'s moat (cost / network / switching / brand / regulatory / scale). Include a market-share table in prose. 2 sidenotes [[SIDENOTE: ...]]. No preamble.`,
      `Competitive landscape deep-dive for ${r.ticker}. Name specific rivals and size the moat. 700-900 words.\n\n${userBase}`,
      { max_tokens: 2800, temperature: 0.5, timeoutMs: 70_000 }
    ),
  ]);
  const batch3 = Promise.all([
    // ---- Call B: Financials ----
    runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "historical": [
    {"year": "FY23", "revenue": "$X.XB", "operatingIncome": "$X.XB", "eps": "$X.XX"}
  ],
  "projected": [
    {"year": "FY26E", "revenue": "$X.XB", "ebitdaMargin": "X%", "eps": "$X.XX"}
  ],
  "keyMetrics": [
    {"label": "Shares Outstanding", "value": "X.XB", "source": "[10-K]"}
  ],
  "dcfNarrative": "one paragraph, 80 words, on WACC + terminal growth + intrinsic anchor"
}`),
    `Produce the FINANCIALS JSON for ${r.ticker}. 3 historical rows, 3 projected rows, 4-6 keyMetrics.\n\n${userBase}`,
    { max_tokens: 1400, temperature: 0.3, timeoutMs: 45_000 }
  ),
    // ---- Call C: Consensus + peer comps ----
    runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "streetView": "one paragraph, 60 words, with [Consensus] tags",
  "peerTickers": ["TICKER1", "TICKER2"],
  "peerNote": "one paragraph, 80 words",
  "ourPt": "$XXX.XX — Y% upside",
  "ptMethodology": "one paragraph, 80 words"
}`),
    `Produce CONSENSUS JSON for ${r.ticker}. Current price ${r.quote ? `$${r.quote.price.toFixed(2)}` : 'n/a'}. Give 4-6 peer tickers.\n\n${userBase}`,
    { max_tokens: 1200, temperature: 0.5, timeoutMs: 45_000 }
  ),
    // ---- Call D: 8-slide deck ----
    runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "deckSlides": [
    {"title": "Cover", "bullets": ["b1","b2","b3"], "speakerNote": "1 sentence"}
  ]
}`),
    `Produce DECK JSON for ${r.ticker}. EXACTLY 8 slides in order: Cover, Business snapshot, Situation, Complication, Bull case, Bear case, Valuation & PT, Call to action. Each slide has exactly 3 bullets (8-15 words each) and one speakerNote.\n\n${userBase}`,
    { max_tokens: 1800, temperature: 0.5, timeoutMs: 45_000 }
  ),
    // ---- Call E: Diligence questions ----
    runModel(
    ai, FAST_MODEL,
    sysJson(`{
  "diligenceQuestions": [
    {"q": "question", "rationale": "one sentence why it matters"}
  ]
}`),
    `Produce DILIGENCE JSON with EXACTLY 5 probing questions a Levin analyst asks management at the next earnings call, each with a one-line rationale.\n\n${userBase}`,
    { max_tokens: 800, temperature: 0.6, timeoutMs: 30_000 }
  ),
  ]);
  const [resolvedBatch1, resolvedBatch2, resolvedBatch3] = await Promise.all([batch1, batch2, batch3]);
  const [rawThesisSpine, rawExec, rawBiz, rawSit, rawComp, rawVal, rawPt] = resolvedBatch1;
  const [rawA2, rawA3, rawA4risks, rawA4cats, rawA5, rawA6, rawMgmt, rawBridge, rawA8] = resolvedBatch2;
  const [rawB, rawC, rawD, rawE] = resolvedBatch3;
  // Thesis spine (small JSON with tagline/bluf/bulls/bears only)
  const thesisParsed = parsePortalJson(rawThesisSpine);
  // Each prose section is now its own plain-markdown call
  const execBody = rawExec ? rawExec.trim() : '';
  const bizBody = rawBiz ? rawBiz.trim() : '';
  const sitBody = rawSit ? rawSit.trim() : '';
  const compBody = rawComp ? rawComp.trim() : '';
  const valBody = rawVal ? rawVal.trim() : '';
  const ptBody = rawPt ? rawPt.trim() : '';
  const support1Parsed = parseMarkdownSection(rawA2);
  const support2Parsed = parseMarkdownSection(rawA3);
  const risksBody = rawA4risks ? rawA4risks.trim() : '';
  const catalystsBody = rawA4cats ? rawA4cats.trim() : '';
  const support3Parsed = parseMarkdownSection(rawA5);
  const sotpParsed = parseMarkdownSection(rawA6);
  const mgmtParsed = parseMarkdownSection(rawMgmt);
  const bridgeBody = rawBridge ? rawBridge.trim() : '';
  const competitiveParsed = parseMarkdownSection(rawA8);
  const financialsParsed = parsePortalJson(rawB);
  const consensusParsed = parsePortalJson(rawC);
  const deckParsed = parsePortalJson(rawD);
  const diligenceParsed = parsePortalJson(rawE);
  console.log(`[portal][${r.ticker}] all 12 calls parsed.`);

  // Extract sidenote markers + strip them from the prose, collecting to sidebar
  const allSidenotes: string[] = [];
  const extractSidenotes = (text: string | undefined): string => {
    if (!text) return '';
    return text.replace(/\[\[SIDENOTE:\s*([^\]]+)\]\]/gi, (_, note) => {
      allSidenotes.push(String(note).trim());
      return '';
    }).replace(/\s+/g, ' ').trim();
  };

  return {
    tagline: (thesisParsed.tagline || `${r.company} — research brief`).replace(/^["']|["']$/g, '').replace(/\.$/, ''),
    bluf: normalizeNumbers(extractSidenotes(thesisParsed.bluf) || 'Price target pending.'),
    executiveSummary: normalizeNumbers(extractSidenotes(execBody) || fallbackBusiness(r)),
    businessOverview: normalizeNumbers(extractSidenotes(bizBody) || 'Business overview pending.'),
    thesisSituation: normalizeNumbers(extractSidenotes(sitBody) || 'Situation analysis pending.'),
    thesisComplication: normalizeNumbers(extractSidenotes(compBody) || 'Complication pending.'),
    supportingPoint1: {
      heading: String(support1Parsed.heading || 'Key bull thesis').trim(),
      body: normalizeNumbers(extractSidenotes(support1Parsed.body) || 'Deep dive pending.'),
    },
    supportingPoint2: {
      heading: String(support2Parsed.heading || 'Secondary bull thesis').trim(),
      body: normalizeNumbers(extractSidenotes(support2Parsed.body) || 'Deep dive pending.'),
    },
    supportingPoint3: {
      heading: String(support3Parsed.heading || 'Third bull driver').trim(),
      body: normalizeNumbers(extractSidenotes(support3Parsed.body) || 'Deep dive pending.'),
    },
    sotpSection: {
      heading: String(sotpParsed.heading || 'Sum-of-parts analysis').trim(),
      body: normalizeNumbers(extractSidenotes(sotpParsed.body) || 'SOTP pending.'),
    },
    mgmtSection: {
      heading: String(mgmtParsed.heading || 'Management and capital allocation').trim(),
      body: normalizeNumbers(extractSidenotes(mgmtParsed.body) || 'Management assessment pending.'),
    },
    competitiveSection: {
      heading: String(competitiveParsed.heading || 'Competitive landscape').trim(),
      body: normalizeNumbers(extractSidenotes(competitiveParsed.body) || 'Competitive analysis pending.'),
    },
    financialBridge: normalizeNumbers(extractSidenotes(bridgeBody) || 'Financial bridge pending.'),
    keyRisks: normalizeNumbers(extractSidenotes(risksBody) || 'Risks pending.'),
    catalystsSection: normalizeNumbers(extractSidenotes(catalystsBody) || 'Catalysts pending.'),
    valuationSection: normalizeNumbers(extractSidenotes(valBody) || fallbackValuation(r)),
    priceTargetSection: normalizeNumbers(extractSidenotes(ptBody) || 'Price target pending.'),
    bullPoints: (Array.isArray(thesisParsed.bullPoints) && thesisParsed.bullPoints.length
      ? thesisParsed.bullPoints : ['Pending regeneration.']).map((b: any) => normalizeNumbers(String(b))),
    bearPoints: (Array.isArray(thesisParsed.bearPoints) && thesisParsed.bearPoints.length
      ? thesisParsed.bearPoints : ['Pending regeneration.']).map((b: any) => normalizeNumbers(String(b))),
    diligenceQuestions: (Array.isArray(diligenceParsed.diligenceQuestions) ? diligenceParsed.diligenceQuestions : [])
      .map((d: any) => ({
        q: normalizeNumbers(String(d.q || '')),
        rationale: normalizeNumbers(String(d.rationale || '')),
      }))
      .filter((d: any) => d.q),
    sidenotes: allSidenotes,
    financials: {
      historical: Array.isArray(financialsParsed?.historical) ? financialsParsed.historical.slice(0, 5).map((h: any) => ({
        year: String(h.year || ''),
        revenue: normalizeNumbers(String(h.revenue || '—')),
        operatingIncome: normalizeNumbers(String(h.operatingIncome || '—')),
        eps: normalizeNumbers(String(h.eps || '—')),
      })) : [],
      projected: Array.isArray(financialsParsed?.projected) ? financialsParsed.projected.slice(0, 5).map((p: any) => ({
        year: String(p.year || ''),
        revenue: normalizeNumbers(String(p.revenue || '—')),
        ebitdaMargin: String(p.ebitdaMargin || '—'),
        eps: normalizeNumbers(String(p.eps || '—')),
      })) : [],
      keyMetrics: Array.isArray(financialsParsed?.keyMetrics) ? financialsParsed.keyMetrics.slice(0, 8).map((k: any) => ({
        label: String(k.label || ''),
        value: normalizeNumbers(String(k.value || '')),
        source: String(k.source || '[10-K]'),
      })).filter((k: any) => k.label) : [],
      dcfNarrative: normalizeNumbers(financialsParsed?.dcfNarrative || ''),
    },
    consensus: {
      streetView: normalizeNumbers(consensusParsed?.streetView || ''),
      peerTickers: (Array.isArray(consensusParsed?.peerTickers) ? consensusParsed.peerTickers : [])
        .map((t: any) => String(t).toUpperCase().trim())
        .filter((t: string) => /^[A-Z]{1,5}(\.[A-Z])?$/.test(t))
        .slice(0, 6),
      peerNote: normalizeNumbers(consensusParsed?.peerNote || ''),
      ourPt: String(consensusParsed?.ourPt || ''),
      ptMethodology: normalizeNumbers(consensusParsed?.ptMethodology || ''),
    },
    deckSlides: (Array.isArray(deckParsed.deckSlides) ? deckParsed.deckSlides : []).slice(0, 10).map((s: any) => ({
      title: normalizeNumbers(String(s.title || '')),
      bullets: Array.isArray(s.bullets) ? s.bullets.map((b: any) => normalizeNumbers(String(b))).filter(Boolean) : [],
      speakerNote: normalizeNumbers(String(s.speakerNote || '')),
    })).filter((s: any) => s.title),
  };
}

/**
 * Extract { heading, body } from a plain-markdown section where the first
 * line is "# heading" and the rest is body prose. Robust against the model
 * emitting stray code fences or extra blank lines.
 */
function parseMarkdownSection(raw: string): { heading: string; body: string } {
  if (!raw) return { heading: '', body: '' };
  const cleaned = raw.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const lines = cleaned.split('\n');
  let heading = '';
  let bodyStart = 0;
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const m = lines[i].match(/^#+\s*(.+?)\s*$/);
    if (m) {
      heading = m[1].trim();
      bodyStart = i + 1;
      break;
    }
  }
  const body = lines.slice(bodyStart).join('\n').trim();
  return { heading, body };
}

function parsePortalJson(raw: string): any {
  if (!raw) return {};
  let s = raw.trim();
  // Strip code fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  const first = s.indexOf('{');
  if (first < 0) return {};
  // Try progressively: full candidate, then trim to last balanced brace, then repair
  const last = s.lastIndexOf('}');
  const attempts: string[] = [];
  if (last > first) attempts.push(s.slice(first, last + 1));
  attempts.push(balanceBraces(s.slice(first)));

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {}
    // Remove trailing commas before `}` or `]`
    const repaired = candidate.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(repaired);
    } catch {}
  }

  console.error('[portal] JSON parse failed. Raw head:', s.slice(0, 400));
  return {};
}

/**
 * Given text starting with `{`, close any unclosed braces/brackets at the
 * end (common when the model was truncated by max_tokens mid-JSON). Strings
 * with unclosed quotes are closed too.
 */
function balanceBraces(s: string): string {
  let depthBrace = 0;
  let depthBracket = 0;
  let inStr = false;
  let escape = false;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    out += c;
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depthBrace++;
    else if (c === '}') depthBrace--;
    else if (c === '[') depthBracket++;
    else if (c === ']') depthBracket--;
  }
  // Close unterminated string
  if (inStr) out += '"';
  // Remove trailing comma if we're about to close
  out = out.replace(/,\s*$/, '');
  // Close any open brackets, then braces
  while (depthBracket > 0) { out += ']'; depthBracket--; }
  while (depthBrace > 0) { out += '}'; depthBrace--; }
  return out;
}

function parseScqa(md: string): {
  situation: string; complication: string; question: string; answer: string;
} {
  const out = { situation: '', complication: '', question: '', answer: '' };
  const pats: Record<keyof typeof out, RegExp> = {
    situation: /\*\*\s*situation\s*:?\s*\*\*\s*([\s\S]*?)(?=\*\*\s*(?:complication|question|answer)\s*:?\s*\*\*|$)/i,
    complication: /\*\*\s*complication\s*:?\s*\*\*\s*([\s\S]*?)(?=\*\*\s*(?:situation|question|answer)\s*:?\s*\*\*|$)/i,
    question: /\*\*\s*question\s*:?\s*\*\*\s*([\s\S]*?)(?=\*\*\s*(?:situation|complication|answer)\s*:?\s*\*\*|$)/i,
    answer: /\*\*\s*answer\s*:?\s*\*\*\s*([\s\S]*?)(?=\*\*\s*(?:situation|complication|question)\s*:?\s*\*\*|$)/i,
  };
  for (const key of Object.keys(pats) as Array<keyof typeof out>) {
    const m = md.match(pats[key]);
    if (m) out[key] = m[1].trim().replace(/^[:\-–—\s]+/, ''); // strip leading colon/dash
  }
  return out;
}

/**
 * Normalize raw SEC-style numbers in plain text prose. Converts e.g.
 *   "$1,208,358" in thousands context → "$1.21B"
 *   "$462,000,000" → "$462M"
 * Heuristic: any bare "$[0-9]{7,}" with no B/M/K suffix gets shortened.
 * Conservative: we never convert numbers that already have suffixes.
 */
export function normalizeNumbers(text: string): string {
  if (!text) return '';
  return text
    // $X.YZ billion/million typed out — leave alone
    // Large dollar figures without unit: $1,234,567 → $1.23M (if <1e9) / $1.23B
    .replace(/\$([0-9]{1,3}(?:,[0-9]{3}){2,})(?!\s*[KMB])/g, (_, n) => {
      const digits = parseFloat(String(n).replace(/,/g, ''));
      if (!Number.isFinite(digits)) return '$' + n;
      // 10-K tables usually report in thousands. A raw "$1,208,358" (no
      // unit) most often means $1.21M (if reported in thousands) OR
      // $1.21B (if reported in millions). We pick the more conservative:
      // if the number is ≥1M assume it's already in $ and format to M/B.
      if (digits >= 1e9) return `$${(digits / 1e9).toFixed(2)}B`;
      if (digits >= 1e6) return `$${(digits / 1e6).toFixed(1)}M`;
      if (digits >= 1e3) return `$${(digits / 1e3).toFixed(1)}K`;
      return '$' + n;
    })
    // Detached raw integers with commas (e.g. "1,208,358 shares")
    .replace(/\b([0-9]{1,3}(?:,[0-9]{3}){2,})\s+(shares|units|employees)/gi, (_, n, word) => {
      const digits = parseFloat(String(n).replace(/,/g, ''));
      if (!Number.isFinite(digits)) return `${n} ${word}`;
      if (digits >= 1e9) return `${(digits / 1e9).toFixed(2)}B ${word}`;
      if (digits >= 1e6) return `${(digits / 1e6).toFixed(1)}M ${word}`;
      if (digits >= 1e3) return `${(digits / 1e3).toFixed(1)}K ${word}`;
      return `${n} ${word}`;
    });
}

function parseFinancials(raw: string): PortalContent['financials'] {
  const empty: PortalContent['financials'] = {
    historical: [], projected: [], keyMetrics: [], dcfNarrative: '',
  };
  if (!raw) return empty;

  // Historical
  const histMatch = raw.match(/HISTORICAL[^:]*:\s*([\s\S]*?)(?=PROJECTED|KEY METRICS|DCF|$)/i);
  const historical: PortalContent['financials']['historical'] = [];
  if (histMatch) {
    const lines = histMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      // FY23 | $... | $... | $...
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 4 && /^FY|^20|^FQ/i.test(parts[0])) {
        historical.push({
          year: parts[0],
          revenue: normalizeNumbers(parts[1]),
          operatingIncome: normalizeNumbers(parts[2]),
          eps: normalizeNumbers(parts[3]),
        });
      }
    }
  }

  // Projected
  const projMatch = raw.match(/PROJECTED[^:]*:\s*([\s\S]*?)(?=KEY METRICS|DCF|$)/i);
  const projected: PortalContent['financials']['projected'] = [];
  if (projMatch) {
    const lines = projMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 4 && /^FY|^20/i.test(parts[0])) {
        projected.push({
          year: parts[0],
          revenue: normalizeNumbers(parts[1]),
          ebitdaMargin: parts[2],
          eps: normalizeNumbers(parts[3]),
        });
      }
    }
  }

  // Key metrics
  const kmMatch = raw.match(/KEY METRICS[^:]*:\s*([\s\S]*?)(?=DCF NARRATIVE|$)/i);
  const keyMetrics: PortalContent['financials']['keyMetrics'] = [];
  if (kmMatch) {
    const lines = kmMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/^-?\s*([^:]+):\s*(.+?)\s*\|\s*(\[?[A-Za-z0-9\-]+\]?)\s*$/);
      if (m) keyMetrics.push({ label: m[1].trim(), value: normalizeNumbers(m[2].trim()), source: m[3].trim() });
    }
  }

  // DCF narrative
  const dcfMatch = raw.match(/DCF NARRATIVE[^:]*:\s*([\s\S]+?)$/i);
  const dcfNarrative = dcfMatch ? normalizeNumbers(dcfMatch[1].trim()) : '';

  return { historical, projected, keyMetrics, dcfNarrative };
}

function parseConsensus(raw: string): PortalContent['consensus'] {
  const empty: PortalContent['consensus'] = {
    streetView: '', peerTickers: [], peerNote: '', ourPt: '', ptMethodology: '',
  };
  if (!raw) return empty;

  const grab = (label: string, next?: string): string => {
    const re = next
      ? new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=${next}\\s*:|$)`, 'i')
      : new RegExp(`${label}\\s*:\\s*([\\s\\S]+?)$`, 'i');
    const m = raw.match(re);
    return m ? m[1].trim() : '';
  };

  const streetView = normalizeNumbers(grab('STREET VIEW', 'PEER TICKERS'));
  const tickersRaw = grab('PEER TICKERS', 'PEER NOTE');
  const peerTickers = tickersRaw
    .replace(/[<>"']/g, '')
    .split(/[,\s]+/)
    .map(t => t.trim().toUpperCase())
    .filter(t => /^[A-Z]{1,5}(\.[A-Z])?$/.test(t))
    .slice(0, 6);
  const peerNote = normalizeNumbers(grab('PEER NOTE', 'OUR PT'));
  const ourPt = grab('OUR PT', 'PT METHODOLOGY').split('\n')[0].trim();
  const ptMethodology = normalizeNumbers(grab('PT METHODOLOGY'));
  return { streetView, peerTickers, peerNote, ourPt, ptMethodology };
}

function parseDeck(raw: string): PortalContent['deckSlides'] {
  if (!raw) return [];
  const slides: PortalContent['deckSlides'] = [];
  const blocks = raw.split(/\n*---\n*/);
  for (const block of blocks) {
    const titleMatch = block.match(/TITLE:\s*(.+)/i);
    const bulletsMatch = block.match(/BULLETS:\s*([\s\S]*?)(?=SPEAKER:|$)/i);
    const speakerMatch = block.match(/SPEAKER:\s*(.+)/is);
    if (!titleMatch) continue;
    const bullets: string[] = [];
    if (bulletsMatch) {
      for (const line of bulletsMatch[1].split('\n')) {
        const m = line.trim().match(/^[-*•]\s+(.+)$/);
        if (m) bullets.push(normalizeNumbers(m[1].trim()));
      }
    }
    slides.push({
      title: normalizeNumbers(titleMatch[1].trim()),
      bullets,
      speakerNote: normalizeNumbers(speakerMatch ? speakerMatch[1].trim() : ''),
    });
  }
  return slides;
}

function parseBullsBears(md: string): { bulls: string[]; bears: string[] } {
  const bulls: string[] = [];
  const bears: string[] = [];
  const bullMatch = md.match(/\*\*\s*bull[^*]*\*\*\s*([\s\S]*?)(?=\*\*\s*bear|$)/i);
  const bearMatch = md.match(/\*\*\s*bear[^*]*\*\*\s*([\s\S]*?)$/i);
  for (const src of [[bullMatch?.[1], bulls], [bearMatch?.[1], bears]] as const) {
    const [text, target] = src;
    if (!text) continue;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const m = line.match(/^[-*•]\s+(.+)$/);
      if (m) target.push(m[1]);
    }
  }
  return { bulls, bears };
}

function parseDiligence(md: string): Array<{ q: string; rationale: string }> {
  const out: Array<{ q: string; rationale: string }> = [];
  const chunks = md.split(/\n*---\n*/);
  for (const chunk of chunks) {
    const qm = chunk.match(/Q:\s*(.+)/i);
    const wm = chunk.match(/WHY:\s*(.+)/i);
    if (qm && wm) out.push({ q: qm[1].trim(), rationale: wm[1].trim() });
  }
  return out;
}

function fallbackBusiness(r: Research): string {
  return `${r.company} (${r.ticker}) is a publicly-traded company. Full business summary pending successful 10-K retrieval and model response. ${r.filing_10k_url ? `Latest 10-K filed ${r.filing_10k_date}.` : '10-K not retrieved.'}`;
}

function fallbackValuation(r: Research): string {
  if (!r.quote) return 'Live quote unavailable; valuation analysis pending.';
  return `${r.ticker} trades at $${r.quote.price.toFixed(2)} as of ${r.quote.as_of.slice(0,10)}. Full peer-multiple analysis pending.`;
}

// Pull the "sector" description from the skill file and expose for routing.
// Lets a future enhancement swap in sector-specific section writers.
export function getSkillMarkdown(): string {
  return skillMarkdown as string;
}
