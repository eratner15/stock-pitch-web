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
    // Larger excerpts so the model has real material to cite from.
    // AMZN-caliber output needs dense number references + specific
    // names + management quotes pulled from the actual 10-K.
    mda_excerpt: tenK.mda.slice(0, 30000),
    risks_excerpt: tenK.risks.slice(0, 15000),
    tenq_excerpt: tenQ.text.slice(0, 10000),
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
  supportingPoint1: { heading: string; body: string }; // deep dive on bull #1
  supportingPoint2: { heading: string; body: string }; // deep dive on bull #2
  keyRisks: string;                                // 300-400 words, multi-risk
  valuationSection: string;                        // 400-500 words, method + multiples
  priceTargetSection: string;                      // 300-400 words, upside/downside math
  catalystsSection: string;                        // 300-400 words, timeline

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

  // PARALLEL — 8 calls at once. Workers AI paid tier handles this. Cuts total
  // runtime from ~3 min sequential to ~60-75s.
  const [rawA, rawA2, rawA3, rawA4, rawB, rawC, rawD, rawE] = await Promise.all([
    runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "tagline": "one-sentence pitch under 20 words, no period",
  "bluf": "3-sentence top-of-memo answer stating the call + price target + catalyst timeline",
  "executiveSummary": "300-word paragraph explaining the investment thesis — setup, mispricing, path to PT. Every claim sourced with [10-K]/[Market]/[Estimated] tags. Name specific segments, dollar amounts, growth rates. Include 1 sidenote marker [[SIDENOTE: ...]].",
  "businessOverview": "400-word analysis of the business: what they sell, segment breakdown with specific revenue contribution, scale (LTM revenue, employees, geographic footprint), and ONE non-obvious structural feature. Every number [10-K]-tagged. 1-2 sidenotes.",
  "thesisSituation": "300-word paragraph on what the MARKET currently prices — consensus EPS, consensus PT mean, current EV/EBITDA or P/E multiple, how the stock has performed. Tag with [Consensus] / [Market] / [Estimated] where needed.",
  "thesisComplication": "300-word paragraph on what's MISPRICED. Specific numerical gap between our view and consensus. Reference the 10-K material the market seems to be discounting.",
  "valuationSection": "400-word section on valuation. Name the method (SOTP / DCF / multiple / asset-value). Show the math: segment-level multiples × segment EBITDA = implied EV. If DCF, state WACC + terminal growth. 1 sidenote.",
  "priceTargetSection": "300-word section. State our PT explicitly. Show upside/downside % vs current price. Scenario table in prose: Base / Bull / Bear. Probability-weighted expected value.",
  "bullPoints": ["5 specific bullets each 18-28 words citing a number from the 10-K"],
  "bearPoints": ["3 specific bullets each 18-28 words citing a risk from Item 1A"]
}`),
    `Produce the CORE THESIS JSON for ${r.ticker}. This is institutional equity research — write as if you've covered this name for 10 years.\n\n${userBase}`,
    { max_tokens: 4500, temperature: 0.5, timeoutMs: 60_000 }
  ),
    // ---- Call A2: Supporting point #1 deep dive ----
    runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "heading": "8-12 word H2 headline making a specific claim about one segment/product/strategy",
  "body": "500-600 word deep-dive on this ONE specific bull driver. Specific numbers, segment revenue, growth rates, margin trajectory. At least 2 sidenotes [[SIDENOTE: ...]]. Cite [10-K] dense."
}`),
    `DEEP DIVE on the STRONGEST bull point for ${r.ticker}. Pick the most material structural advantage disclosed in the 10-K MD&A. Write a 500-word section that stands on its own.\n\n${userBase}`,
    { max_tokens: 2500, temperature: 0.55, timeoutMs: 60_000 }
  ),
    // ---- Call A3: Supporting point #2 ----
    runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "heading": "8-12 word H2 headline",
  "body": "500-600 word deep-dive on a DIFFERENT bull driver than the first. 2 sidenotes. Dense [10-K]."
}`),
    `DEEP DIVE on the SECOND-STRONGEST bull point for ${r.ticker}. Different theme from the first deep-dive. Pick a segment, product launch, margin expansion, cap-ex cycle, or capital return story.\n\n${userBase}`,
    { max_tokens: 2500, temperature: 0.55, timeoutMs: 60_000 }
  ),
    // ---- Call A4: Risks section ----
    runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "keyRisks": "400-word section covering 3-4 SPECIFIC risks that could invalidate the thesis. Each risk gets ~100 words. Pull from Item 1A Risk Factors. Label each risk as a bold heading. Include 1 sidenote.",
  "catalystsSection": "400-word section listing 3-5 time-bound catalysts over the next 12-24 months that move the stock. Each catalyst dated (e.g. 'Q4 FY26 earnings, February 2026'). Explain WHY each moves the stock."
}`),
    `Produce RISKS + CATALYSTS JSON for ${r.ticker}. Be specific — name the events, dates, quantify where possible.\n\n${userBase}`,
    { max_tokens: 2500, temperature: 0.5, timeoutMs: 60_000 }
  ),
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
  const thesisParsed = parsePortalJson(rawA);
  const support1Parsed = parsePortalJson(rawA2);
  const support2Parsed = parsePortalJson(rawA3);
  const risksParsed = parsePortalJson(rawA4);
  const financialsParsed = parsePortalJson(rawB);
  const consensusParsed = parsePortalJson(rawC);
  const deckParsed = parsePortalJson(rawD);
  const diligenceParsed = parsePortalJson(rawE);
  console.log(`[portal][${r.ticker}] all 8 calls parsed. thesis keys: ${Object.keys(thesisParsed).length}`);

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
    bluf: normalizeNumbers(extractSidenotes(thesisParsed.bluf) || thesisParsed.answer || 'Price target pending.'),
    executiveSummary: normalizeNumbers(extractSidenotes(thesisParsed.executiveSummary) || fallbackBusiness(r)),
    businessOverview: normalizeNumbers(extractSidenotes(thesisParsed.businessOverview) || 'Business overview pending.'),
    thesisSituation: normalizeNumbers(extractSidenotes(thesisParsed.thesisSituation) || 'Situation analysis pending.'),
    thesisComplication: normalizeNumbers(extractSidenotes(thesisParsed.thesisComplication) || 'Complication pending.'),
    supportingPoint1: {
      heading: String(support1Parsed.heading || 'Key bull thesis').trim(),
      body: normalizeNumbers(extractSidenotes(support1Parsed.body) || 'Deep dive pending.'),
    },
    supportingPoint2: {
      heading: String(support2Parsed.heading || 'Secondary bull thesis').trim(),
      body: normalizeNumbers(extractSidenotes(support2Parsed.body) || 'Deep dive pending.'),
    },
    keyRisks: normalizeNumbers(extractSidenotes(risksParsed.keyRisks) || 'Risks pending.'),
    catalystsSection: normalizeNumbers(extractSidenotes(risksParsed.catalystsSection) || 'Catalysts pending.'),
    valuationSection: normalizeNumbers(extractSidenotes(thesisParsed.valuationSection) || fallbackValuation(r)),
    priceTargetSection: normalizeNumbers(extractSidenotes(thesisParsed.priceTargetSection) || 'Price target pending.'),
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
