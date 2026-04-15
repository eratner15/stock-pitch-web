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

// Primary writer — Llama 3.3 70B on Workers AI. Good long-form writing,
// free on CF. Override via env for Claude/etc. later.
const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const FAST_MODEL = '@cf/google/gemma-4-26b-a4b-it';

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
    // Cap excerpts so the combined prompt stays <80K tokens — plenty of
    // signal, well inside Llama's context window.
    mda_excerpt: tenK.mda.slice(0, 40000),
    risks_excerpt: tenK.risks.slice(0, 20000),
    tenq_excerpt: tenQ.text.slice(0, 20000),
    thesis: args.thesis ?? null,
    direction: args.direction ?? null,
    price_target: args.price_target ?? null,
  };
}

// ---------------------------------------------------------------------------
// AI call helper — Workers AI dispatch with OpenAI-compatible response shape
// ---------------------------------------------------------------------------

async function runModel(
  ai: any,
  model: string,
  system: string,
  user: string,
  opts: { max_tokens?: number; temperature?: number } = {}
): Promise<string> {
  try {
    const res = await ai.run(model, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: opts.max_tokens ?? 2048,
      temperature: opts.temperature ?? 0.5,
    });
    const text: string | undefined =
      res?.choices?.[0]?.message?.content ?? res?.response;
    return (text ?? '').trim();
  } catch (err) {
    console.error(`[portal] model ${model} failed:`, err);
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

  // Parallelize: each section is an independent call. Fail-fast: if a call
  // returns empty, we fall back to a deterministic placeholder.
  const [
    businessSummary,
    scqa,
    bullsBears,
    valuation,
    diligence,
    tagline,
  ] = await Promise.all([
    runModel(
      ai, PRIMARY_MODEL, VOICE_SYSTEM,
      `Write a 2-3 paragraph business summary of ${r.company} (${r.ticker}) using ONLY facts from the research card below. Cover: what the business does, primary revenue segments, scale (revenue, segment breakdown), and one non-obvious structural feature. Every number MUST carry a [10-K] tag.\n\n${researchCard}`,
      { max_tokens: 1200, temperature: 0.4 }
    ),
    runModel(
      ai, PRIMARY_MODEL, VOICE_SYSTEM,
      `Write an SCQA (Situation, Complication, Question, Answer) analysis of the investment case for ${r.ticker}. Four paragraphs with those four labels in bold.
- SITUATION: what the market sees, current consensus view
- COMPLICATION: what's overlooked or mispriced
- QUESTION: the single question that resolves the thesis
- ANSWER: our view + path to a price target

Base your view on the 10-K filings below. Every financial claim carries a source tag. Do not invent numbers.

${researchCard}`,
      { max_tokens: 1800, temperature: 0.55 }
    ),
    runModel(
      ai, PRIMARY_MODEL, VOICE_SYSTEM,
      `For ${r.ticker}, produce:

**BULL POINTS** (3-5 bullets): specific structural advantages or catalysts, grounded in the 10-K.

**BEAR POINTS** (2-3 bullets): specific risks or thesis-killers from Item 1A Risk Factors.

Use plain markdown "-" bullets. No preamble. Every number sourced.

${researchCard}`,
      { max_tokens: 1400, temperature: 0.5 }
    ),
    runModel(
      ai, PRIMARY_MODEL, VOICE_SYSTEM,
      `Write ONE paragraph on ${r.ticker}'s valuation. Reference the current price ${r.quote ? `($${r.quote.price.toFixed(2)})` : ''}. Name the method (multiple-on-earnings, DCF, SOTP, NAV, etc.) and the rough multiple range peers trade at, qualitatively. If you don't have specific peer multiples, say "peer multiples pending" rather than invent. One paragraph, 120 words max.\n\n${researchCard}`,
      { max_tokens: 600, temperature: 0.4 }
    ),
    runModel(
      ai, FAST_MODEL, VOICE_SYSTEM,
      `Generate 5 probing questions a Levin analyst would ask management on the next earnings call for ${r.ticker}. For each: one question, one-line rationale. Output format:
Q: <question>
WHY: <rationale>
---
${researchCard}`,
      { max_tokens: 800, temperature: 0.6 }
    ),
    runModel(
      ai, FAST_MODEL, VOICE_SYSTEM,
      `Write ONE-SENTENCE pitch tagline for ${r.ticker}. Direct, no hype. Under 20 words. No period at end. Example format: "The premium-nutrition compounder at a recession multiple". Just the tagline, nothing else.\n\n${researchCard}`,
      { max_tokens: 80, temperature: 0.7 }
    ),
  ]);

  // Parse SCQA into 4 sections
  const scqaSections = parseScqa(scqa);
  // Parse bulls/bears
  const { bulls, bears } = parseBullsBears(bullsBears);
  // Parse diligence Q&A
  const diligenceQs = parseDiligence(diligence);

  return {
    businessSummary: businessSummary || fallbackBusiness(r),
    situation: scqaSections.situation || 'Situation analysis unavailable — rerun generation.',
    complication: scqaSections.complication || 'Complication unavailable.',
    centralQuestion: scqaSections.question || 'Question unavailable.',
    answer: scqaSections.answer || 'Answer unavailable.',
    bullPoints: bulls.length > 0 ? bulls : ['Bull case pending rerun.'],
    bearPoints: bears.length > 0 ? bears : ['Bear case pending rerun.'],
    valuationNote: valuation || fallbackValuation(r),
    diligenceQuestions: diligenceQs.length > 0 ? diligenceQs : [],
    tagline: (tagline || `${r.company} — research brief`).replace(/^["']|["']$/g, '').replace(/\.$/, ''),
  };
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
    if (m) out[key] = m[1].trim();
  }
  return out;
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
