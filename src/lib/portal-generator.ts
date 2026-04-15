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
    mda_excerpt: tenK.mda.slice(0, 6000),
    risks_excerpt: tenK.risks.slice(0, 3000),
    tenq_excerpt: tenQ.text.slice(0, 3000),
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
const VOICE_SYSTEM = `You are a senior sell-side equity research analyst at Levin Capital Strategies. Voice: direct, specific, analytical. No hype, no exclamation points. Every financial number MUST carry a source tag: [10-K], [10-Q], [Transcript], [IR], [Market], [Consensus], [Computed], or [Estimated] with methodology. If you cannot source a number, say "not disclosed" rather than invent one. Write institutional prose; never address the reader as "you".`;

export interface PortalContent {
  businessSummary: string;       // 2-3 paragraphs, [10-K] tags
  situation: string;             // SCQA paragraph
  complication: string;
  centralQuestion: string;
  answer: string;
  bullPoints: string[];          // 3-5 bullets
  bearPoints: string[];          // 2-3 bullets
  valuationNote: string;         // 1 paragraph, cites quote + peers
  diligenceQuestions: Array<{ q: string; rationale: string }>;
  tagline: string;               // one-line thesis

  // Model page
  financials: {
    historical: Array<{ year: string; revenue: string; operatingIncome: string; eps: string }>;
    projected: Array<{ year: string; revenue: string; ebitdaMargin: string; eps: string }>;
    keyMetrics: Array<{ label: string; value: string; source: string }>;
    dcfNarrative: string;
  };

  // Consensus page
  consensus: {
    streetView: string;           // paragraph on sell-side consensus
    peerTickers: string[];        // 4-6 ticker symbols
    peerNote: string;             // paragraph comparing target to peers
    ourPt: string;                // "$X — Y% upside/downside"
    ptMethodology: string;        // 1-paragraph how we get there
  };

  // Deck page — slide-by-slide titles + bullets
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

  console.log(`[portal][${r.ticker}] 5-call generation. mda=${r.mda_excerpt.length} risks=${r.risks_excerpt.length} 10q=${r.tenq_excerpt.length}`);
  // ---- Call A: Core thesis ----
  const rawA = await runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "tagline": "one-sentence pitch, under 20 words, no period",
  "businessSummary": "2 short paragraphs, each 80 words, with [10-K] tags",
  "situation": "one paragraph, 60 words",
  "complication": "one paragraph, 60 words",
  "centralQuestion": "one sentence",
  "answer": "one paragraph, 80 words, ends with a price target",
  "bullPoints": ["3-5 bullets, 12-20 words each"],
  "bearPoints": ["2-3 bullets, 12-20 words each"],
  "valuationNote": "one paragraph, 80 words"
}`),
    `Produce the CORE THESIS JSON for ${r.ticker}.\n\n${userBase}`,
    { max_tokens: 2000, temperature: 0.5, timeoutMs: 45_000 }
  );
  const thesisParsed = parsePortalJson(rawA);
  console.log(`[portal][${r.ticker}] thesis keys: ${Object.keys(thesisParsed).length}`);

  // ---- Call B: Financials ----
  const rawB = await runModel(
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
  );
  const financialsParsed = parsePortalJson(rawB);

  // ---- Call C: Consensus + peer comps ----
  const rawC = await runModel(
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
  );
  const consensusParsed = parsePortalJson(rawC);

  // ---- Call D: 8-slide deck ----
  const rawD = await runModel(
    ai, PRIMARY_MODEL,
    sysJson(`{
  "deckSlides": [
    {"title": "Cover", "bullets": ["b1","b2","b3"], "speakerNote": "1 sentence"}
  ]
}`),
    `Produce DECK JSON for ${r.ticker}. EXACTLY 8 slides in order: Cover, Business snapshot, Situation, Complication, Bull case, Bear case, Valuation & PT, Call to action. Each slide has exactly 3 bullets (8-15 words each) and one speakerNote.\n\n${userBase}`,
    { max_tokens: 1800, temperature: 0.5, timeoutMs: 45_000 }
  );
  const deckParsed = parsePortalJson(rawD);

  // ---- Call E: Diligence questions ----
  const rawE = await runModel(
    ai, FAST_MODEL,
    sysJson(`{
  "diligenceQuestions": [
    {"q": "question", "rationale": "one sentence why it matters"}
  ]
}`),
    `Produce DILIGENCE JSON with EXACTLY 5 probing questions a Levin analyst asks management at the next earnings call, each with a one-line rationale.\n\n${userBase}`,
    { max_tokens: 800, temperature: 0.6, timeoutMs: 30_000 }
  );
  const diligenceParsed = parsePortalJson(rawE);

  // Merge all five into a single parsed object
  const parsed: any = {
    ...thesisParsed,
    financials: financialsParsed,
    consensus: consensusParsed,
    deckSlides: deckParsed.deckSlides ?? [],
    diligenceQuestions: diligenceParsed.diligenceQuestions ?? [],
  };

  return {
    businessSummary: normalizeNumbers(parsed.businessSummary || fallbackBusiness(r)),
    situation: normalizeNumbers(parsed.situation || 'Pending regeneration.'),
    complication: normalizeNumbers(parsed.complication || 'Pending regeneration.'),
    centralQuestion: normalizeNumbers(parsed.centralQuestion || 'Pending regeneration.'),
    answer: normalizeNumbers(parsed.answer || 'Pending regeneration.'),
    bullPoints: (parsed.bullPoints?.length ? parsed.bullPoints : ['Pending regeneration.']).map(normalizeNumbers),
    bearPoints: (parsed.bearPoints?.length ? parsed.bearPoints : ['Pending regeneration.']).map(normalizeNumbers),
    valuationNote: normalizeNumbers(parsed.valuationNote || fallbackValuation(r)),
    diligenceQuestions: (parsed.diligenceQuestions || []).map((d: any) => ({
      q: normalizeNumbers(String(d.q || '')),
      rationale: normalizeNumbers(String(d.rationale || '')),
    })).filter((d: any) => d.q),
    tagline: (parsed.tagline || `${r.company} — research brief`).replace(/^["']|["']$/g, '').replace(/\.$/, ''),
    financials: {
      historical: Array.isArray(parsed.financials?.historical) ? parsed.financials.historical.slice(0, 5).map((h: any) => ({
        year: String(h.year || ''),
        revenue: normalizeNumbers(String(h.revenue || '—')),
        operatingIncome: normalizeNumbers(String(h.operatingIncome || '—')),
        eps: normalizeNumbers(String(h.eps || '—')),
      })) : [],
      projected: Array.isArray(parsed.financials?.projected) ? parsed.financials.projected.slice(0, 5).map((p: any) => ({
        year: String(p.year || ''),
        revenue: normalizeNumbers(String(p.revenue || '—')),
        ebitdaMargin: String(p.ebitdaMargin || '—'),
        eps: normalizeNumbers(String(p.eps || '—')),
      })) : [],
      keyMetrics: Array.isArray(parsed.financials?.keyMetrics) ? parsed.financials.keyMetrics.slice(0, 8).map((k: any) => ({
        label: String(k.label || ''),
        value: normalizeNumbers(String(k.value || '')),
        source: String(k.source || '[10-K]'),
      })).filter((k: any) => k.label) : [],
      dcfNarrative: normalizeNumbers(parsed.financials?.dcfNarrative || ''),
    },
    consensus: {
      streetView: normalizeNumbers(parsed.consensus?.streetView || ''),
      peerTickers: (Array.isArray(parsed.consensus?.peerTickers) ? parsed.consensus.peerTickers : [])
        .map((t: any) => String(t).toUpperCase().trim())
        .filter((t: string) => /^[A-Z]{1,5}(\.[A-Z])?$/.test(t))
        .slice(0, 6),
      peerNote: normalizeNumbers(parsed.consensus?.peerNote || ''),
      ourPt: String(parsed.consensus?.ourPt || ''),
      ptMethodology: normalizeNumbers(parsed.consensus?.ptMethodology || ''),
    },
    deckSlides: (Array.isArray(parsed.deckSlides) ? parsed.deckSlides : []).slice(0, 10).map((s: any) => ({
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
