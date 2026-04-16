/**
 * Research Agent — Durable Object with Claude Sonnet as orchestrator.
 * Uses native Anthropic SDK (bypasses AI SDK Zod v4 schema bug).
 * Think-ready: will migrate to Think once AI SDK fixes Zod v4 → Anthropic tool schema conversion.
 */
import { DurableObject } from 'cloudflare:workers';
import Anthropic from '@anthropic-ai/sdk';
import { fetchPrice } from '../lib/prices';
import { getCik, fetchLatest10K, fetchLatest10Q } from '../lib/edgar';

const SYSTEM = `You are a senior equity research analyst at Levin Capital Strategies producing institutional-caliber investment memos.

TOOLS: fetch_stock_price, fetch_sec_filing, store_portal. Use them SYSTEMATICALLY.

PROCESS:
1. fetch_stock_price — get current price
2. fetch_sec_filing with filing_type="10-K" — get financials + risks
3. Analyze the data deeply — identify mispricing, catalysts, risks
4. Write your investment thesis with [10-K] source tags on every number
5. store_portal with your price target, direction, and confidence score

RULES:
- Every dollar amount, growth rate, and ratio tagged with [10-K], [Market], [Consensus], or [Computed]
- Name names: CEO, products, competitors, specific dollar amounts
- Include price target with Base (60%), Bull (25%), Bear (15%) scenarios
- "Not disclosed" if unknown — NEVER fabricate numbers`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'fetch_stock_price',
    description: 'Get current stock price, company name, and 1-day change for a US equity ticker',
    input_schema: { type: 'object' as const, properties: { ticker: { type: 'string', description: 'Stock ticker (e.g. META, AAPL, BRK.B)' } }, required: ['ticker'] },
  },
  {
    name: 'fetch_sec_filing',
    description: 'Fetch the latest 10-K or 10-Q filing from SEC EDGAR. Returns MD&A excerpt and risk factors.',
    input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' }, filing_type: { type: 'string', enum: ['10-K', '10-Q'] } }, required: ['ticker', 'filing_type'] },
  },
  {
    name: 'store_portal',
    description: 'Save your completed research to the library. Call when analysis is done.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ticker: { type: 'string' }, company: { type: 'string' },
        direction: { type: 'string', enum: ['long', 'short'] },
        price_target: { type: 'number' }, current_price: { type: 'number' },
        confidence: { type: 'number', description: '0-100' },
        summary: { type: 'string', description: '1-2 sentence BLUF' },
      },
      required: ['ticker', 'company', 'direction', 'price_target', 'current_price', 'confidence', 'summary'],
    },
  },
];

export class ResearchAgent extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.endsWith('/research')) {
      const body = await request.json() as any;
      const ticker = String(body.ticker || '').toUpperCase().replace(/[^A-Z.]/g, '');
      if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 });
      return this.runResearch(ticker);
    }
    return new Response('Research Agent — POST /research {"ticker":"META"}');
  }

  async runResearch(ticker: string): Promise<Response> {
    const client = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
    const messages: Anthropic.MessageParam[] = [{
      role: 'user',
      content: `Research ${ticker} and produce a comprehensive institutional investment analysis. Use your tools to gather data, then write a detailed thesis with a price target.`,
    }];

    let response = await client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 8192, system: SYSTEM, messages, tools: TOOLS });
    const toolLog: string[] = [];
    let loops = 0;

    while (response.stop_reason === 'tool_use' && loops < 15) {
      loops++;
      const toolBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const results = await Promise.all(toolBlocks.map(async (block) => {
        const args = block.input as any;
        let result: any;
        try {
          if (block.name === 'fetch_stock_price') {
            const q = await fetchPrice(String(args.ticker));
            result = q ? { ticker: q.ticker, price: q.price, company: q.company, change_1d: q.change_1d, as_of: q.as_of } : { error: `Cannot price ${args.ticker}` };
          } else if (block.name === 'fetch_sec_filing') {
            const cikResult = await getCik(String(args.ticker));
            if (!cikResult) { result = { error: 'CIK not found' }; }
            else if (String(args.filing_type) === '10-K') {
              const f = await fetchLatest10K(cikResult.cik);
              result = f ? { url: f.url, date: f.date, mda: f.mda.slice(0, 15000), risks: f.risks.slice(0, 8000) } : { error: 'No 10-K' };
            } else {
              const f = await fetchLatest10Q(cikResult.cik);
              result = f ? { url: f.url, date: f.date, text: f.text.slice(0, 5000) } : { error: 'No 10-Q' };
            }
          } else if (block.name === 'store_portal') {
            const upside = args.current_price > 0 ? (args.price_target - args.current_price) / args.current_price : 0;
            const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
            await this.env.DB.prepare(`
              INSERT INTO portals (id, ticker, company, direction, rating, price_at_generation, price_target, upside_pct, confidence_index, summary, generated_at)
              VALUES (?, ?, ?, ?, 'BUY', ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(ticker) DO UPDATE SET company=excluded.company, direction=excluded.direction, price_at_generation=excluded.price_at_generation, price_target=excluded.price_target, upside_pct=excluded.upside_pct, confidence_index=excluded.confidence_index, summary=excluded.summary, generated_at=excluded.generated_at
            `).bind(id, args.ticker, args.company, args.direction, args.current_price, args.price_target, upside, args.confidence, args.summary).run();
            result = { stored: true, ticker: args.ticker, confidence: args.confidence, upside: `${(upside * 100).toFixed(0)}%` };
          } else { result = { error: `Unknown tool: ${block.name}` }; }
        } catch (e) { result = { error: String(e).slice(0, 200) }; }
        toolLog.push(`${block.name}(${JSON.stringify(args).slice(0, 80)}) → ${JSON.stringify(result).slice(0, 100)}`);
        return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(result) };
      }));

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: results });
      response = await client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 8192, system: SYSTEM, messages, tools: TOOLS });
    }

    const finalText = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n');
    return Response.json({ ok: true, ticker, words: finalText.split(/\s+/).length, tool_loops: loops, tools_called: toolLog, analysis: finalText, usage: response.usage });
  }
}
