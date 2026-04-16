import { AIChatAgent, type OnChatMessageOptions } from '@cloudflare/ai-chat';
import { createWorkersAI } from 'workers-ai-provider';
import { streamText, tool, convertToModelMessages } from 'ai';
import { z } from 'zod';

import { fetchPrice, fetchPriceHistory } from '../lib/prices';
import { getCik, fetchLatest10K, fetchLatest10Q } from '../lib/edgar';
import { extractClaims, verifyClaims } from '../lib/improve/fact-verify';

const RESEARCH_PLAYBOOK = `You are a senior equity research analyst at Levin Capital Strategies. You produce institutional-caliber 15-section investment memos.

PROCESS:
1. fetch_stock_price — get current price
2. fetch_sec_filing with 10-K — get financials, risks, MD&A
3. fetch_sec_filing with 10-Q — get latest quarter
4. detect_sector — classify and get analytical framework
5. Write each memo section using write_memo_section (15 sections total)
6. verify_claims — check numbers against filing
7. store_portal — save the completed research

WRITING RULES:
- Every number gets a source tag: [10-K], [10-Q], [Market], [Consensus], [Computed], [Estimated]
- 6+ data points per 300 words. Name names. No hype.
- "Not disclosed" if unknown — NEVER invent numbers
- Include price target with 3 scenarios (Base 60%, Bull 25%, Bear 15%)

SECTIONS: Executive Summary, Business Overview, Situation, Complication, 3× Bull Deep-Dives, SOTP, Management, Competitive, Revenue Bridge, Risks, Catalysts, Valuation, Price Target.`;

export class ResearchAgent extends AIChatAgent<Env> {
  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    try {
    console.log('[agent] onChatMessage called, messages:', this.messages.length);
    const workersai = createWorkersAI({ binding: this.env.AI });
    const env = this.env;

    const modelMessages = await convertToModelMessages(this.messages);
    console.log('[agent] model messages:', modelMessages.length);

    const result = streamText({
      model: workersai('@cf/meta/llama-3.3-70b-instruct-fp8-fast'),
      system: RESEARCH_PLAYBOOK,
      messages: modelMessages,
      maxSteps: 25,
      abortSignal: options?.abortSignal,
      tools: {
        fetch_stock_price: tool({
          description: 'Get current stock price, company name, 1-day change',
          parameters: z.object({
            ticker: z.string().describe('Stock ticker (e.g. AAPL, BRK.B)'),
          }),
          execute: async ({ ticker }) => {
            const quote = await fetchPrice(ticker);
            if (!quote) return { error: `Could not price ${ticker}` };
            return { ticker: quote.ticker, price: quote.price, company: quote.company, change_1d: quote.change_1d, as_of: quote.as_of };
          },
        }),

        fetch_price_history: tool({
          description: 'Get 1-year daily closing prices',
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            const h = await fetchPriceHistory(ticker);
            return { points: h.length, first: h[0]?.c, last: h[h.length - 1]?.c, high: Math.max(...h.map(p => p.c)), low: Math.min(...h.map(p => p.c)) };
          },
        }),

        fetch_sec_filing: tool({
          description: 'Fetch 10-K or 10-Q from SEC EDGAR. Returns MD&A, risk factors, filing metadata.',
          parameters: z.object({
            ticker: z.string(),
            filing_type: z.enum(['10-K', '10-Q']),
          }),
          execute: async ({ ticker, filing_type }) => {
            const cik = await getCik(ticker);
            if (!cik) return { error: `CIK not found for ${ticker}` };
            if (filing_type === '10-K') {
              const f = await fetchLatest10K(cik);
              if (!f) return { error: `No 10-K found` };
              return { url: f.url, date: f.date, mda_excerpt: f.mda.slice(0, 25000), risk_factors: f.risks.slice(0, 12000), full_text_length: f.fullText.length };
            }
            const f = await fetchLatest10Q(cik);
            if (!f) return { error: `No 10-Q found` };
            return { url: f.url, date: f.date, excerpt: f.text.slice(0, 8000) };
          },
        }),

        detect_sector: tool({
          description: 'Classify company into sector, get analytical framework',
          parameters: z.object({ filing_text_sample: z.string().describe('First 3000 chars of 10-K') }),
          execute: async ({ filing_text_sample }) => {
            const t = filing_text_sample.toLowerCase();
            const map: [string, RegExp, string][] = [
              ['REIT', /real estate investment trust|reit|funds from operations/i, 'NAV/share, AFFO/FFO, cap rate, WALT'],
              ['BANK', /net interest income|tier 1 capital|provision for credit/i, 'TBV, NIM, efficiency ratio, CET1'],
              ['SAAS', /subscription|annual recurring|net retention|saas/i, 'ARR, NRR, Rule of 40, FCF margin'],
              ['BIOTECH', /clinical trial|fda|pipeline|phase [123]/i, 'Pipeline rNPV, PDUFA, cash runway'],
              ['ENERGY', /proved reserves|barrels|mcf|drilling/i, 'Reserves, production, F&D costs'],
              ['CONSUMER', /same.store|organic growth|brand|retail/i, 'Organic growth, same-store, gross margin'],
            ];
            for (const [name, rx, fw] of map) { if (rx.test(t)) return { sector: name, framework: fw }; }
            return { sector: 'GENERAL', framework: 'Revenue growth, margin expansion, FCF yield, ROIC' };
          },
        }),

        write_memo_section: tool({
          description: 'Record a completed memo section. Call this for each of the 15 sections as you write them.',
          parameters: z.object({
            section_name: z.string().describe('e.g. executive_summary, business_overview, risks, catalysts, price_target'),
            content: z.string().describe('Full section prose with source tags, 500-1000 words'),
          }),
          execute: async ({ section_name, content }) => {
            const wc = content.split(/\s+/).length;
            const tags = (content.match(/\[(10-K|10-Q|Transcript|Market|Consensus|Computed|Estimated)\]/g) || []).length;
            return { section: section_name, word_count: wc, source_tags: tags, status: wc < 200 ? 'too_short' : 'ok' };
          },
        }),

        verify_claims: tool({
          description: 'Check numerical claims in text against source 10-K filing',
          parameters: z.object({
            memo_text: z.string(),
            filing_text: z.string(),
            section_name: z.string(),
          }),
          execute: async ({ memo_text, filing_text, section_name }) => {
            const claims = extractClaims(memo_text, section_name);
            const r = verifyClaims(claims, filing_text);
            return { total: r.total_claims, verified: r.verified, rate: r.verification_rate, unverified: r.unverified_claims.slice(0, 3) };
          },
        }),

        store_portal: tool({
          description: 'Save completed research to the library. Call when all sections are done.',
          parameters: z.object({
            ticker: z.string(),
            company: z.string(),
            sector: z.string(),
            direction: z.enum(['long', 'short']),
            rating: z.string(),
            price_target: z.number(),
            current_price: z.number(),
            confidence: z.number().min(0).max(100),
            summary: z.string().describe('1-2 sentence BLUF'),
          }),
          execute: async ({ ticker, company, sector, direction, rating, price_target, current_price, confidence, summary }) => {
            const upside = current_price > 0 ? (price_target - current_price) / current_price : 0;
            const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
            await env.DB.prepare(`
              INSERT INTO portals (id, ticker, company, sector, direction, rating, price_at_generation, price_target, upside_pct, confidence_index, summary, generated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(ticker) DO UPDATE SET company=excluded.company, sector=excluded.sector, direction=excluded.direction, rating=excluded.rating, price_at_generation=excluded.price_at_generation, price_target=excluded.price_target, upside_pct=excluded.upside_pct, confidence_index=excluded.confidence_index, summary=excluded.summary, generated_at=excluded.generated_at
            `).bind(id, ticker, company, sector, direction, rating, current_price, price_target, upside, confidence, summary).run();
            return { stored: true, ticker, confidence, upside: `${(upside * 100).toFixed(0)}%` };
          },
        }),
      },
      abortSignal: options?.abortSignal,
    });

    return result.toUIMessageStreamResponse();
    } catch (e) {
      console.error('[agent] onChatMessage error:', e, (e as any)?.stack);
      throw e;
    }
  }
}
