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

import { fetchPrice, fetchPriceHistory, type PriceQuote } from './prices';
import {
  getCik,
  fetchLatest10K,
  fetchLatest10Q,
} from './edgar';
import { verifyPortal as runFactVerifier } from './improve/fact-verify';

// Model routing: right model for the right job.
// - PRIMARY: long-form institutional prose (Llama 3.3 70B, best writer)
// - NUMBERS: structured financial JSON (Gemma 4 26B, reasoning model, better with numbers)
// - FAST: low-stakes structured output like deck slides + diligence Qs (Llama 8B, fast)
const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
// Gemma 4 12B doesn't exist on Workers AI — use PRIMARY for structured JSON too
const NUMBERS_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const FAST_MODEL = '@cf/meta/llama-3.1-8b-instruct';

// ---------------------------------------------------------------------------
// Research payload — what the writer sees
// ---------------------------------------------------------------------------

export interface Research {
  ticker: string;
  company: string;
  cik: string | null;
  quote: PriceQuote | null;
  price_history: Array<{ t: number; c: number }>; // 1Y daily closes
  filing_10k_url: string | null;
  filing_10k_date: string | null;
  filing_10q_url: string | null;
  filing_10q_date: string | null;
  mda_excerpt: string;       // capped for prompt size
  risks_excerpt: string;
  tenq_excerpt: string;
  tenk_raw_for_verify: string; // full 10-K text for fact verifier, not in prompts
  thesis: string | null;
  direction: 'long' | 'short' | null;
  price_target: number | null;
  sector: string;              // detected sector for template routing
}

export async function collectResearch(args: {
  ticker: string;
  thesis?: string | null;
  direction?: 'long' | 'short' | null;
  price_target?: number | null;
}): Promise<Research> {
  const t = args.ticker.toUpperCase();

  // Parallel data pulls
  const [cik, quote, priceHistory, tenK, tenQ] = await Promise.all([
    getCik(t),
    fetchPrice(t),
    fetchPriceHistory(t),
    fetchLatest10K(t),
    fetchLatest10Q(t),
  ]);

  const sector = detectSector(tenK.rawText || '', quote?.company || cik?.name || t);

  return {
    ticker: t,
    company: quote?.company ?? cik?.name ?? t,
    cik: cik?.cik ?? null,
    quote,
    price_history: priceHistory,
    filing_10k_url: tenK.filing?.documentUrl ?? null,
    filing_10k_date: tenK.filing?.filingDate ?? null,
    filing_10q_url: tenQ.filing?.documentUrl ?? null,
    filing_10q_date: tenQ.filing?.filingDate ?? null,
    // Llama 3.3 70B context = 24K tokens ≈ 72K chars. With system prompt + output,
    // user message budget is ~40K chars. Split: 22K mda + 10K risks + 8K 10q = 40K
    mda_excerpt: tenK.mda.slice(0, 22000),
    risks_excerpt: tenK.risks.slice(0, 10000),
    tenq_excerpt: tenQ.text.slice(0, 8000),
    // Keep full raw 10-K for the fact verifier pass. Not passed into prompts.
    tenk_raw_for_verify: tenK.rawText || '',
    thesis: args.thesis ?? null,
    direction: args.direction ?? null,
    price_target: args.price_target ?? null,
    sector,
  };
}

// --------------------------------------------------------------------------
// Sector detection + guidance — routes per-sector prompt hints
// --------------------------------------------------------------------------
export type Sector =
  | 'REIT' | 'BANK' | 'INSURANCE' | 'ENERGY' | 'SAAS'
  | 'BIOTECH' | 'ASSET_MANAGER' | 'CONSUMER' | 'INDUSTRIAL' | 'GENERIC';

export function detectSector(tenKText: string, companyName: string): Sector {
  const text = (tenKText + ' ' + companyName).toLowerCase();
  if (/real estate investment trust|we elected? to be taxed as a reit|funds from operations|ffo per share|nav per share/.test(text)) return 'REIT';
  if (/bank holding company|federally insured|net interest margin|tier 1 capital|cet1|common equity tier/.test(text)) return 'BANK';
  if (/insurance company|combined ratio|loss ratio|reinsurance|underwriting result|gross premium/.test(text)) return 'INSURANCE';
  if (/oil and gas|upstream|hydrocarbon reserves|barrels of oil equivalent|natural gas producer|refining margin/.test(text)) return 'ENERGY';
  if (/annual recurring revenue|net revenue retention|saas|cloud subscription|daily active users/.test(text)) return 'SAAS';
  if (/clinical trial|phase [i1]{1,3}\b|food and drug administration|biosimilar|orphan drug|pdufa/.test(text)) return 'BIOTECH';
  if (/assets under management|carried interest|fee-related earnings|distributable earnings|management fees|performance fees/.test(text)) return 'ASSET_MANAGER';
  if (/consumer products|direct-to-consumer|brand portfolio|same-store sales|comparable store sales/.test(text)) return 'CONSUMER';
  if (/manufacturing operations|original equipment manufacturer|book-to-bill|aftermarket/.test(text)) return 'INDUSTRIAL';
  return 'GENERIC';
}

export function sectorGuidance(sector: Sector): string {
  switch (sector) {
    case 'REIT': return `This is a REIT. Use NAV/share, AFFO/FFO per share, cap rate, debt/EBITDA, and WALT. Property-level NOI > accounting EPS.`;
    case 'BANK': return `This is a bank. Use tangible book value per share, NIM, efficiency ratio, CET1, NPL ratio. Tangible book growth > EPS.`;
    case 'INSURANCE': return `This is an insurer. Use combined ratio, loss ratio, book value per share, investment-portfolio yield. Underwriting vs investment income separately.`;
    case 'ENERGY': return `This is an energy producer. Use reserves, production, full-cycle break-even, F&D costs, hedge book. Reserve replacement > headline EPS.`;
    case 'SAAS': return `This is SaaS/cloud. Use ARR, NRR, GRR, CAC payback, Rule of 40, FCF margin. Reference ARR and LTM revenue both.`;
    case 'BIOTECH': return `This is a biotech. Use pipeline asset-by-asset: phase, PDUFA dates, probability of success, risk-adjusted peak sales. Cash runway > EPS.`;
    case 'ASSET_MANAGER': return `This is an alt asset manager. Use AUM, FRE, DE, carried-interest realizations, dry powder. FRE multiple separate from carry multiple.`;
    case 'CONSUMER': return `This is consumer / retail. Use organic revenue growth, same-store-sales, gross margin trajectory, A&P spend as % revenue, inventory days.`;
    case 'INDUSTRIAL': return `This is industrial. Use book-to-bill, backlog (months of revenue), aftermarket mix, operating leverage, order intake.`;
    default: return `Use sector-appropriate metrics — recurring revenue → ARR/NRR, capital-intensive → ROIC, commodity-exposed → name the commodity.`;
  }
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
  opts: { max_tokens?: number; temperature?: number; timeoutMs?: number; minChars?: number } = {}
): Promise<string> {
  // Retry up to 2 times if the first call returns too-short content.
  // Workers AI has a non-trivial rate of empty/failed responses on long
  // prompts; a single retry usually succeeds.
  const first = await runModelOnce(ai, model, system, user, opts);
  if (first.length >= (opts.minChars ?? 200)) return first;
  console.warn(`[portal] runModel retry — first attempt returned ${first.length}ch on ${model}`);
  const second = await runModelOnce(ai, model, system, user, opts);
  return second.length > first.length ? second : first;
}

async function runModelOnce(
  ai: any,
  model: string,
  system: string,
  user: string,
  opts: { max_tokens?: number; temperature?: number; timeoutMs?: number; minChars?: number } = {}
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

  // Structured metadata for confidence pipeline + books
  priceTargetNum: number | null;
  impliedUpside: number | null;
  direction: 'long' | 'short';
  rating: string;
  sector: string;

  // Fact verification results (computed at generation time)
  verificationRate: number;
  totalClaims: number;
  verifiedClaims: number;

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

  // Voice + sector guidance — every call gets the sector hint so the
  // prompts nudge toward REIT / bank / SaaS / commodity / etc. frameworks.
  const sectorHint = sectorGuidance(r.sector as Sector);
  const voiceWithSector = VOICE_SYSTEM + `\n\nSECTOR CONTEXT: ${sectorHint}`;
  const sysJson = (schemaHint: string) => `${voiceWithSector}

Return ONE JSON object, nothing else — no preamble, no markdown fence.
Schema:
${schemaHint}

Every financial number MUST include a source tag like [10-K]. Report revenues in $M. If a number isn't disclosed, use "n.d." — NEVER invent.`;

  const userBase = `Ticker: ${r.ticker}
Company: ${r.company}
Research card:
${researchCard}`;

  console.log(`[portal][${r.ticker}] deep generation start. mda=${r.mda_excerpt.length} risks=${r.risks_excerpt.length} 10q=${r.tenq_excerpt.length}`);

  // ══════════════════════════════════════════════════════════════
  // ORCHESTRATOR PIPELINE: foundation → prose → polish
  // Phase 1 runs first; its output feeds Phase 2 as context so
  // every prose section references the same financial model, PT,
  // and thesis. This replaces the old 3-parallel-batch approach.
  // ══════════════════════════════════════════════════════════════

  // ── PHASE 1: FOUNDATION (sequential to avoid Workers AI concurrency drops) ──
  const rawThesisSpine = await runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "tagline": "one-sentence pitch under 20 words, no period, specific claim",
  "bluf": "4-5 sentence top-of-memo answer stating the call, PT with upside %, primary bull driver, primary risk, catalyst timeline. Every number tagged.",
  "bullPoints": ["6 bullets each 22-32 words citing a specific number from 10-K"],
  "bearPoints": ["4 bullets each 22-32 words citing a specific risk from Item 1A"]
}`),
    `Produce the THESIS SPINE JSON for ${r.ticker} — tagline, BLUF, bulls, bears. Concise and specific.\n\n${userBase}`,
    { max_tokens: 2000, temperature: 0.5, timeoutMs: 50_000 }
  );
  const rawFinancials = await runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "historical": [{"year": "FY23", "revenue": "$X.XB", "operatingIncome": "$X.XB", "eps": "$X.XX"}],
  "projected": [{"year": "FY26E", "revenue": "$X.XB", "ebitdaMargin": "X%", "eps": "$X.XX"}],
  "keyMetrics": [{"label": "Shares Outstanding", "value": "X.XB", "source": "[10-K]"}],
  "dcfNarrative": "one paragraph, 80 words, on WACC + terminal growth + intrinsic anchor"
}`),
    `Produce the FINANCIALS JSON for ${r.ticker}. 3 historical rows, 3 projected rows, 4-6 keyMetrics.\n\n${userBase}`,
    { max_tokens: 1400, temperature: 0.3, timeoutMs: 50_000 }
  );
  const rawConsensus = await runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "streetView": "one paragraph, 60 words, with [Consensus] tags",
  "peerTickers": ["TICKER1", "TICKER2"],
  "peerNote": "one paragraph, 80 words",
  "ourPt": "$XXX.XX — Y% upside",
  "ptMethodology": "one paragraph, 80 words"
}`),
    `Produce CONSENSUS JSON for ${r.ticker}. Current price ${r.quote ? `$${r.quote.price.toFixed(2)}` : 'n/a'}. Give 4-6 peer tickers.\n\n${userBase}`,
    { max_tokens: 1200, temperature: 0.5, timeoutMs: 50_000 }
  );

  // Parse foundation results → build context block for Phase 2
  console.log(`[portal][${r.ticker}] Phase 1 raw: thesis=${(rawThesisSpine||'').length}c financials=${(rawFinancials||'').length}c consensus=${(rawConsensus||'').length}c`);
  // Retry empty Phase 1 JSON via Anthropic API (Workers AI unreliable for structured JSON)
  let finalFinancials = rawFinancials;
  let finalConsensus = rawConsensus;
  if ((rawFinancials||'').length < 50) {
    console.log(`[portal][${r.ticker}] Financials empty, trying Anthropic API fallback...`);
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: (env as any).ANTHROPIC_API_KEY });
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 1500,
        system: 'Return ONE JSON object, no markdown fence. Every financial number must include a source tag like [10-K].',
        messages: [{ role: 'user', content: `Produce FINANCIALS JSON for ${r.ticker} (${r.company}). Current price: ${r.quote ? '$'+r.quote.price.toFixed(2) : 'n/a'}.\n\nSchema: {"historical":[{"year":"FY23","revenue":"$X.XB","operatingIncome":"$X.XB","eps":"$X.XX"}],"projected":[{"year":"FY26E","revenue":"$X.XB","ebitdaMargin":"X%","eps":"$X.XX"}],"keyMetrics":[{"label":"Metric","value":"X","source":"[10-K]"}],"dcfNarrative":"80 words"}\n\n3 historical rows, 3 projected, 4-6 keyMetrics.\n\n10-K excerpt:\n${r.mda_excerpt.slice(0, 8000)}` }],
      });
      const text = resp.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text').map(b => b.text).join('');
      if (text.length > 50) { finalFinancials = text; console.log(`[portal][${r.ticker}] Financials recovered via Anthropic (${text.length}c)`); }
    } catch (e) { console.error(`[portal][${r.ticker}] Anthropic financials fallback failed:`, e); }
  }
  if ((rawConsensus||'').length < 50) {
    console.log(`[portal][${r.ticker}] Consensus empty, trying Anthropic API fallback...`);
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: (env as any).ANTHROPIC_API_KEY });
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514', max_tokens: 1200,
        system: 'Return ONE JSON object, no markdown fence.',
        messages: [{ role: 'user', content: `Produce CONSENSUS JSON for ${r.ticker} (${r.company}). Current price: ${r.quote ? '$'+r.quote.price.toFixed(2) : 'n/a'}.\n\nSchema: {"streetView":"60 words with [Consensus] tags","peerTickers":["TICKER1"],"peerNote":"80 words","ourPt":"$XXX — Y% upside","ptMethodology":"80 words"}\n\n4-6 peer tickers.\n\n10-K excerpt:\n${r.mda_excerpt.slice(0, 5000)}` }],
      });
      const text = resp.content.filter((b): b is { type: 'text'; text: string } => b.type === 'text').map(b => b.text).join('');
      if (text.length > 50) { finalConsensus = text; console.log(`[portal][${r.ticker}] Consensus recovered via Anthropic (${text.length}c)`); }
    } catch (e) { console.error(`[portal][${r.ticker}] Anthropic consensus fallback failed:`, e); }
  }
  const thesisParsed = parsePortalJson(rawThesisSpine);
  const financialsParsed = parsePortalJson(finalFinancials);
  const consensusParsed = parsePortalJson(finalConsensus);
  console.log(`[portal][${r.ticker}] Phase 1 parsed: hist=${(financialsParsed.historical||[]).length} proj=${(financialsParsed.projected||[]).length} peers=${(consensusParsed.peerTickers||[]).length} pt=${consensusParsed.ourPt||'none'}`);
  const foundationContext = `
FOUNDATION — reference these in your section for consistency:
THESIS: ${thesisParsed.tagline || ''} | BLUF: ${(thesisParsed.bluf || '').slice(0, 200)}
PRICE TARGET: ${consensusParsed.ourPt || 'pending'}
FINANCIALS: ${(financialsParsed.historical || []).map((h: any) => `${h.year}: Rev ${h.revenue}, EPS ${h.eps}`).join('; ')} | Projected: ${(financialsParsed.projected || []).map((p: any) => `${p.year}: Rev ${p.revenue}, EPS ${p.eps}`).join('; ')}
PEERS: ${(consensusParsed.peerTickers || []).join(', ')}
`.trim();

  console.log(`[portal][${r.ticker}] Phase 1 done. Foundation: PT=${consensusParsed.ourPt || 'n/a'}, ${(financialsParsed.historical || []).length} hist rows.`);

  // ── PHASE 2: PROSE (16 calls, all with foundation context) ──
  const userWithFoundation = `${userBase}\n\n${foundationContext}`;

  const batch1 = Promise.all([
    // Plain markdown for each prose section
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT: 500-600 words of executive-summary prose. No heading. 4+ specific dollar amounts, 3+ growth rates, 2+ specific dates. 2 sidenote markers [[SIDENOTE: ...]]. Dense source tags.`,
      `Write the EXECUTIVE SUMMARY for ${r.ticker}. Setup → mispricing → PT → catalyst timeline. 500-600 words.\n\n${userWithFoundation}`,
      { max_tokens: 2200, temperature: 0.5, timeoutMs: 65_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT: **write 800-1000 words — do NOT stop before 800 words**. No heading. Five paragraphs minimum:
  P1: What the business does + total revenue + employee count + geographic footprint
  P2: Segment 1 — revenue, op margin, growth rate, key products, customer concentration
  P3: Segment 2 — same structure
  P4: Segment 3 (or geographic split if only 2 segments) — same structure
  P5: One non-obvious structural feature the market doesn't discuss + why it matters
3 sidenotes [[SIDENOTE: ...]]. 10+ source tags. Every dollar carries [10-K].`,
      `Write the BUSINESS OVERVIEW for ${r.ticker}. 800-1000 words in 5 paragraphs.\n\n${userWithFoundation}`,
      { max_tokens: 3500, temperature: 0.5, timeoutMs: 75_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT: 500-600 words on what the MARKET currently prices. No heading. Cover: consensus EPS path year-by-year, current P/E or EV/EBITDA or EV/Sales, stock performance 1Y/3Y/5Y, analyst rating mix (Buy/Hold/Sell count), narrative the Street has settled on. Tag [Consensus]/[Market]/[Estimated]. 1-2 sidenotes.`,
      `Write THE SITUATION section for ${r.ticker}.\n\n${userWithFoundation}`,
      { max_tokens: 2200, temperature: 0.5, timeoutMs: 65_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT: 500-600 words on what's MISPRICED. No heading. Specific numerical gap: consensus FY26E EPS X vs our Y. Reference specific 10-K material the market is discounting (guidance commentary, segment disclosures, capex trajectory). 2 sidenotes.`,
      `Write THE COMPLICATION section for ${r.ticker}.\n\n${userWithFoundation}`,
      { max_tokens: 2200, temperature: 0.5, timeoutMs: 65_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT: 700-900 words of valuation analysis. No heading. Name method (SOTP / DCF / multiple / NAV). Show math end-to-end: assumptions → multiple → per-share value. If DCF, state WACC (risk-free, ERP, beta) + terminal growth. Compare to 5Y historical trading range. 2 sidenotes.`,
      `Write the VALUATION section for ${r.ticker}. Current price ${r.quote ? '$'+r.quote.price.toFixed(2) : 'n/a'}. 700-900 words.\n\n${userWithFoundation}`,
      { max_tokens: 3200, temperature: 0.5, timeoutMs: 70_000 }
    ),
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT: 500-700 words. No heading. State PT explicitly. Show upside/downside vs current. Three scenarios — Base (60%), Bull (25%), Bear (15%) — each with specific price, driver, EPS assumption, multiple. Probability-weighted EV at the end.`,
      `Write the PRICE TARGET SECTION for ${r.ticker} with three scenarios. Current price ${r.quote ? '$'+r.quote.price.toFixed(2) : 'n/a'}.\n\n${userWithFoundation}`,
      { max_tokens: 2400, temperature: 0.5, timeoutMs: 65_000 }
    ),
  ]);
  // Split batch2 into 2 sub-batches (5+4) to stay under Workers AI concurrency limit
  const batch2a = Promise.all([
    // ---- Call A2: Supporting point #1 (plain markdown output) ----
    runModel(
    ai, PRIMARY_MODEL,
    voiceWithSector + `

OUTPUT FORMAT: FIRST line is "# " followed by an 8-12 word argumentative H2 headline. Remaining content is 800-1000 words of prose in 4-5 paragraphs. Every financial number carries a source tag. 15+ source tags total. 3 sidenote markers [[SIDENOTE: ...]]. No preamble, no meta.`,
    `Write the STRONGEST bull-case deep-dive for ${r.ticker}. Pick the most material structural advantage in the 10-K MD&A. Cover: 3-year revenue trajectory with growth rates, margin path with percentages, named products/customers/partnerships, competitive positioning with named rivals, guidance quotes, and capex/R&D.\n\n${userWithFoundation}`,
    { max_tokens: 3500, temperature: 0.55, timeoutMs: 75_000 }
  ),
    // ---- Call A3: Supporting point #2 (plain markdown output) ----
    runModel(
    ai, PRIMARY_MODEL,
    voiceWithSector + `

OUTPUT FORMAT: FIRST line is "# " + 8-12 word H2. Then 800-1000 words of institutional analysis in 4-5 paragraphs. 15+ source tags. 3 sidenote markers [[SIDENOTE: ...]]. No preamble.`,
    `Write the SECOND-STRONGEST bull deep-dive for ${r.ticker}. ORTHOGONAL to the first deep dive (different axis).\n\n${userWithFoundation}`,
    { max_tokens: 3500, temperature: 0.55, timeoutMs: 75_000 }
  ),
    // ---- Call A4: Risks (plain markdown) ----
    runModel(
    ai, PRIMARY_MODEL,
    voiceWithSector + `

OUTPUT FORMAT: 700-900 words of prose covering 4-5 specific risks. Each risk is a paragraph starting with a **bold heading**. Include: probability (low/medium/high), magnitude (EPS hit or multiple compression), warning signs, historical precedent. 2 sidenotes [[SIDENOTE: ...]]. No preamble.`,
    `Write the KEY RISKS section for ${r.ticker}. 4-5 specific risks from Item 1A risk factors. Each risk must have a bold heading, probability, magnitude estimate, and warning signs. 700-900 words. START IMMEDIATELY with the first risk heading — no introduction.\n\n${userWithFoundation}`,
    { max_tokens: 3200, temperature: 0.55, timeoutMs: 80_000, minChars: 300 }
  ),
    // ---- Call A4b: Catalysts (plain markdown) ----
    runModel(
    ai, PRIMARY_MODEL,
    voiceWithSector + `

OUTPUT FORMAT: 600-800 words of prose listing 5-7 time-bound catalysts over the next 12-24 months. Each catalyst is a paragraph starting with a **bold date+event heading** like "**Q1 FY26 earnings · February 2026**". Include: what the event is, how it moves the stock (price delta), Street consensus vs our view, what would be a beat vs miss. 1-2 sidenotes [[SIDENOTE: ...]]. No preamble.`,
    `Write the CATALYSTS section for ${r.ticker}. 5-7 time-bound events with specific calendar dates (e.g. "Q2 FY26 earnings · July 2026"). Each catalyst: what happens, price impact estimate, Street consensus vs our view. START IMMEDIATELY with the first catalyst heading — no introduction.\n\n${userWithFoundation}`,
    { max_tokens: 2800, temperature: 0.55, timeoutMs: 80_000, minChars: 300 }
  ),
  ]);
  const batch2b = Promise.all([
    // ---- Call A5: Third supporting deep dive (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT FORMAT: FIRST line is "# " + 8-12 word H2. Then 800-1000 words, 4-5 paragraphs, 15+ source tags, 3 sidenotes [[SIDENOTE: ...]]. No preamble.`,
      `Write a THIRD bull deep-dive for ${r.ticker}. Orthogonal to the first two (pick: international expansion, margin inflection, capex cycle, capital return, product cycle, regulatory tailwind, pricing power).\n\n${userWithFoundation}`,
      { max_tokens: 3500, temperature: 0.55, timeoutMs: 75_000 }
    ),
    // ---- Call A6: SOTP / Hidden Value (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT FORMAT: FIRST line is "# " + 8-12 word H2. Then 800-1000 words of prose. Table-in-prose: break out each segment/asset, estimate revenue and EBITDA [10-K], apply a peer multiple (cite the peer), arrive at a value [Computed]. Sum to get implied EV. Compare to current mkt cap. Flag hidden assets. 3 sidenotes.`,
      `Sum-of-parts / hidden value deep-dive for ${r.ticker}. Segment-by-segment math. 800-1000 words.\n\n${userWithFoundation}`,
      { max_tokens: 3500, temperature: 0.5, timeoutMs: 75_000 }
    ),
    // ---- Call A7: Management (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT FORMAT: FIRST line is "# " + 10-12 word H2 on management + capital allocation. Then 700-900 words of prose. Name CEO, CFO, tenure, prior roles. Cite buybacks ($ amounts + share count reductions over 3-5 years), dividends initiated/raised, major M&A (names + prices + IRR), capex trajectory. Compare capital return as % of FCF to peers. Named past decisions that created or destroyed value. 2 sidenotes [[SIDENOTE: ...]]. No preamble.`,
      `Management + capital allocation deep-dive for ${r.ticker}. 700-900 words. Name names and cite dollars.\n\n${userWithFoundation}`,
      { max_tokens: 2800, temperature: 0.5, timeoutMs: 70_000 }
    ),
    // ---- Call A7b: Revenue & Earnings Bridge (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT FORMAT: 700-900 words of prose, no heading. Walk from last-reported revenue → next 3-year revenue, decomposing by segment growth rates (organic vs acquired). Then walk from revenue → operating income (margin assumptions stated) → EPS (share count + tax rate stated). Include a Street-consensus vs our-estimates comparison. 2 sidenotes [[SIDENOTE: ...]]. Dense [10-K]/[Estimated] tags. No preamble.`,
      `Revenue & earnings bridge for ${r.ticker}. Walk forward 3 years with segment decomposition.\n\n${userWithFoundation}`,
      { max_tokens: 2800, temperature: 0.4, timeoutMs: 70_000 }
    ),
    // ---- Call A8: Competitive Landscape (plain markdown) ----
    runModel(
      ai, PRIMARY_MODEL,
      voiceWithSector + `

OUTPUT FORMAT: FIRST line is "# " + 10-12 word H2 on competitive positioning. Then **800-1000 words — do not stop before 800 words**.
  P1: Market structure overview — total addressable market size, growth rate, top 5 players by market share %
  P2: Direct Competitor 1 — name, revenue, margin, where they compete, taking share vs losing
  P3: Direct Competitor 2 — same structure
  P4: Direct Competitor 3 — same structure
  P5: ${r.ticker}'s moat — cost / network / switching / brand / regulatory / scale — with specific evidence
15+ source tags [10-K], [Market], [Computed]. 3 sidenote markers [[SIDENOTE: ...]]. Every competitor revenue carries a [Market] or [10-K] tag. No preamble.`,
      `Competitive landscape deep-dive for ${r.ticker}. 800-1000 words with specific competitor revenues, market share %, and moat evidence. Minimum 15 source tags.\n\n${userWithFoundation}`,
      { max_tokens: 3500, temperature: 0.5, timeoutMs: 80_000 }
    ),
  ]);
  // ── PHASE 3: POLISH (deck + diligence — lightweight structured output) ──
  // Financials (rawB) and Consensus (rawC) already ran in Phase 1.
  const batch3 = Promise.all([
    // ---- Call D: 8-slide deck (FAST_MODEL — structured, low-stakes) ----
    runModel(
    ai, FAST_MODEL,
    sysJson(`{
  "deckSlides": [
    {"title": "Cover", "bullets": ["b1","b2","b3"], "speakerNote": "1 sentence"}
  ]
}`),
    `Produce DECK JSON for ${r.ticker}. EXACTLY 8 slides in order: Cover, Business snapshot, Situation, Complication, Bull case, Bear case, Valuation & PT, Call to action. Each slide has exactly 3 bullets (8-15 words each) and one speakerNote.\n\n${userWithFoundation}`,
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
    `Produce DILIGENCE JSON with EXACTLY 5 probing questions a Levin analyst asks management at the next earnings call, each with a one-line rationale.\n\n${userWithFoundation}`,
    { max_tokens: 800, temperature: 0.6, timeoutMs: 30_000 }
  ),
  ]);
  // Phase 2+3 run in parallel (thesis spine already resolved in Phase 1)
  // Run batch1 + batch3 in parallel, then batch2a + batch2b sequentially
  const [resolvedBatch1, resolvedBatch3] = await Promise.all([batch1, batch3]);
  const resolvedBatch2a = await batch2a;
  const resolvedBatch2b = await batch2b;
  const resolvedBatch2 = [...resolvedBatch2a, ...resolvedBatch2b];
  const [rawExec, rawBiz, rawSit, rawComp, rawVal, rawPt] = resolvedBatch1;
  const [rawA2, rawA3, rawA4risks, rawA4cats, rawA5, rawA6, rawMgmt, rawBridge, rawA8] = resolvedBatch2;
  const [rawD, rawE] = resolvedBatch3;
  // thesisParsed, financialsParsed, consensusParsed already resolved in Phase 1
  const execBody = rawExec ? rawExec.trim() : '';
  const bizBody = rawBiz ? rawBiz.trim() : '';
  const sitBody = rawSit ? rawSit.trim() : '';
  const compBody = rawComp ? rawComp.trim() : '';
  const valBody = rawVal ? rawVal.trim() : '';
  const ptBody = rawPt ? rawPt.trim() : '';
  const support1Parsed = parseMarkdownSection(rawA2);
  const support2Parsed = parseMarkdownSection(rawA3);
  let risksBody = rawA4risks ? rawA4risks.trim() : '';
  let catalystsBody = rawA4cats ? rawA4cats.trim() : '';

  // Targeted retry for critical "pending" sections — risks and catalysts are key conviction drivers
  const RISK_PROMPT = voiceWithSector + `\nOUTPUT FORMAT: 700-900 words covering 4-5 specific risks. Each risk = bold heading + paragraph with probability (low/medium/high), magnitude (EPS impact or multiple compression), warning signs to monitor, and historical precedent. 2 sidenotes [[SIDENOTE: ...]]. No preamble — start directly with the first risk heading.`;
  const CATALYST_PROMPT = voiceWithSector + `\nOUTPUT FORMAT: 600-800 words listing 5-7 time-bound catalysts. Each catalyst = bold date+event heading (e.g. "**Q2 FY26 earnings · July 2026**") + paragraph with what event is, price delta estimate, Street consensus vs our view, beat vs miss scenario. 1-2 sidenotes [[SIDENOTE: ...]]. No preamble — start directly with the first catalyst heading.`;

  for (let attempt = 0; attempt < 2 && risksBody.length < 200; attempt++) {
    console.log(`[portal][${r.ticker}] Risks too short (${risksBody.length}), retry ${attempt + 1}...`);
    const retryRisks = await runModel(
      ai, PRIMARY_MODEL,
      RISK_PROMPT,
      `Write the KEY RISKS section for ${r.ticker}. Pull directly from Item 1A risk factors in the 10-K filing. 4-5 specific, concrete risks with numbers. 700+ words minimum.\n\nRISK FACTORS FROM 10-K:\n${r.risks_excerpt.slice(0, 15000)}\n\n${userWithFoundation}`,
      { max_tokens: 3500, temperature: 0.65 + attempt * 0.1, timeoutMs: 100_000, minChars: 300 }
    );
    if (retryRisks && retryRisks.trim().length > risksBody.length) {
      risksBody = retryRisks.trim();
    }
  }

  for (let attempt = 0; attempt < 2 && catalystsBody.length < 200; attempt++) {
    console.log(`[portal][${r.ticker}] Catalysts too short (${catalystsBody.length}), retry ${attempt + 1}...`);
    const retryCats = await runModel(
      ai, PRIMARY_MODEL,
      CATALYST_PROMPT,
      `Write the CATALYSTS section for ${r.ticker}. 5-7 time-bound events over the next 12-24 months. Include earnings dates, product launches, regulatory decisions, M&A timelines. Each with specific calendar date.\n\n${userWithFoundation}`,
      { max_tokens: 3000, temperature: 0.65 + attempt * 0.1, timeoutMs: 100_000, minChars: 300 }
    );
    if (retryCats && retryCats.trim().length > catalystsBody.length) {
      catalystsBody = retryCats.trim();
    }
  }

  // Last-resort: if still empty, synthesize from raw 10-K risk factors
  if (risksBody.length < 100 && r.risks_excerpt.length > 500) {
    console.log(`[portal][${r.ticker}] Risks: using 10-K excerpt as fallback`);
    risksBody = `**Key risks identified in ${r.ticker}'s 10-K filing (Item 1A):**\n\n${r.risks_excerpt.slice(0, 3000).replace(/\s+/g, ' ')}`;
  }
  const support3Parsed = parseMarkdownSection(rawA5);
  const sotpParsed = parseMarkdownSection(rawA6);
  const mgmtParsed = parseMarkdownSection(rawMgmt);
  let bridgeBody = rawBridge ? rawBridge.trim() : '';
  const competitiveParsed = parseMarkdownSection(rawA8);
  // financialsParsed + consensusParsed already parsed in Phase 1
  const deckParsed = parsePortalJson(rawD);
  const diligenceParsed = parsePortalJson(rawE);
  // ── COMPLETENESS SWEEP — retry any section still empty ──
  const sectionMap: Record<string, { body: string; prompt: string }> = {
    support1: { body: support1Parsed.body || '', prompt: `Write the STRONGEST bull-case deep-dive for ${r.ticker}. 800-1000 words.\n\n${userWithFoundation}` },
    support2: { body: support2Parsed.body || '', prompt: `Write the SECOND bull deep-dive for ${r.ticker}. 800-1000 words.\n\n${userWithFoundation}` },
    support3: { body: support3Parsed.body || '', prompt: `Write a THIRD bull deep-dive for ${r.ticker}. 800-1000 words.\n\n${userWithFoundation}` },
    sotp: { body: sotpParsed.body || '', prompt: `Sum-of-parts / hidden value deep-dive for ${r.ticker}. 800-1000 words.\n\n${userWithFoundation}` },
    mgmt: { body: mgmtParsed.body || '', prompt: `Management + capital allocation for ${r.ticker}. 700-900 words.\n\n${userWithFoundation}` },
    competitive: { body: competitiveParsed.body || '', prompt: `Competitive landscape for ${r.ticker}. 800-1000 words.\n\n${userWithFoundation}` },
    bridge: { body: bridgeBody, prompt: `Revenue & earnings bridge for ${r.ticker}. 700-900 words.\n\n${userWithFoundation}` },
  };

  const incomplete = Object.entries(sectionMap).filter(([, v]) => v.body.length < 200);
  if (incomplete.length > 0) {
    console.log(`[portal][${r.ticker}] Completeness sweep: ${incomplete.length} sections need retry: ${incomplete.map(([k]) => k).join(', ')}`);
    for (const [name, { prompt }] of incomplete) {
      const retry = await runModel(ai, PRIMARY_MODEL, voiceWithSector + '\nOUTPUT FORMAT: FIRST line "# " + heading. Then 700-1000 words of institutional prose. 15+ source tags. No preamble.', prompt, { max_tokens: 3500, temperature: 0.6, timeoutMs: 90_000, minChars: 300 });
      if (retry && retry.trim().length > 200) {
        const parsed = parseMarkdownSection(retry);
        if (name === 'support1') { support1Parsed.heading = parsed.heading || support1Parsed.heading; support1Parsed.body = parsed.body || support1Parsed.body; }
        else if (name === 'support2') { support2Parsed.heading = parsed.heading || support2Parsed.heading; support2Parsed.body = parsed.body || support2Parsed.body; }
        else if (name === 'support3') { support3Parsed.heading = parsed.heading || support3Parsed.heading; support3Parsed.body = parsed.body || support3Parsed.body; }
        else if (name === 'sotp') { sotpParsed.heading = parsed.heading || sotpParsed.heading; sotpParsed.body = parsed.body || sotpParsed.body; }
        else if (name === 'mgmt') { mgmtParsed.heading = parsed.heading || mgmtParsed.heading; mgmtParsed.body = parsed.body || mgmtParsed.body; }
        else if (name === 'competitive') { competitiveParsed.heading = parsed.heading || competitiveParsed.heading; competitiveParsed.body = parsed.body || competitiveParsed.body; }
        else if (name === 'bridge') { bridgeBody = retry.trim(); }
        console.log(`[portal][${r.ticker}] Sweep: ${name} recovered (${retry.trim().length} chars)`);
      }
    }
  }
  console.log(`[portal][${r.ticker}] All phases complete. Foundation → Prose → Polish.`);

  // Extract sidenote markers + strip them from the prose, collecting to sidebar
  const allSidenotes: string[] = [];
  const extractSidenotes = (text: string | undefined): string => {
    if (!text) return '';
    return text.replace(/\[\[SIDENOTE:\s*([^\]]+)\]\]/gi, (_, note) => {
      allSidenotes.push(String(note).trim());
      return '';
    }).replace(/\s+/g, ' ').trim();
  };

  // Run fact verifier inline while we have the raw 10-K
  let _vr = { rate: 0, total: 0, verified: 0 };
  try {
    if (r.tenk_raw_for_verify && r.tenk_raw_for_verify.length > 500) {
      const tempContent = {
        executiveSummary: execBody, businessOverview: bizBody,
        thesisSituation: sitBody, thesisComplication: compBody,
        supportingPoint1: { body: support1Parsed.body || '' },
        supportingPoint2: { body: support2Parsed.body || '' },
        supportingPoint3: { body: support3Parsed.body || '' },
        keyRisks: risksBody, valuationSection: valBody,
        priceTargetSection: ptBody, catalystsSection: catalystsBody,
        sotpSection: { body: sotpParsed.body || '' },
        mgmtSection: { body: mgmtParsed.body || '' },
        competitiveSection: { body: competitiveParsed.body || '' },
        financialBridge: bridgeBody,
      };
      const vResult = runFactVerifier(tempContent, r.tenk_raw_for_verify);
      _vr = { rate: vResult.verification_rate, total: vResult.total_claims, verified: vResult.verified };
      console.log(`[portal][${r.ticker}] Fact check: ${vResult.verified}/${vResult.total_claims} claims verified (${(vResult.verification_rate*100).toFixed(0)}%)`);
    }
  } catch (e) {
    console.error('[portal] fact verifier failed (non-fatal)', e);
  }

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
    // Fact verification results (computed inline above)
    verificationRate: _vr.rate,
    totalClaims: _vr.total,
    verifiedClaims: _vr.verified,

    // Structured metadata for confidence pipeline + books
    priceTargetNum: (() => {
      const sources = [String(consensusParsed?.ourPt || ''), ptBody || '', String(thesisParsed?.bluf || '')];
      for (const src of sources) {
        const m = src.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
        if (m) return parseFloat(m[1]);
      }
      return null;
    })(),
    impliedUpside: (() => {
      const sources = [String(consensusParsed?.ourPt || ''), ptBody || '', String(thesisParsed?.bluf || '')];
      let pt: number | null = null;
      for (const src of sources) {
        const m = src.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
        if (m) { pt = parseFloat(m[1]); break; }
      }
      if (pt && r.quote && r.quote.price > 0) return (pt - r.quote.price) / r.quote.price;
      return null;
    })(),
    direction: (() => {
      const sources = [String(consensusParsed?.ourPt || ''), ptBody || ''];
      let pt: number | null = null;
      for (const src of sources) {
        const m = src.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
        if (m) { pt = parseFloat(m[1]); break; }
      }
      return (pt && r.quote && pt > r.quote.price) ? 'long' as const : 'short' as const;
    })(),
    rating: String(consensusParsed?.rating || thesisParsed?.rating || 'BUY'),
    sector: r.sector || '',

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
