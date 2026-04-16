/**
 * Research Agent — Durable Object + Claude Sonnet orchestrator.
 * Native Anthropic SDK (bypasses AI SDK Zod v4 bug: cloudflare/agents#1322).
 * Will migrate to Think once upstream fix ships.
 */
import { DurableObject } from 'cloudflare:workers';
import Anthropic from '@anthropic-ai/sdk';
import { fetchPrice } from '../lib/prices';
import { getCik, fetchLatest10K, fetchLatest10Q } from '../lib/edgar';

const SYSTEM = `You are a senior equity research analyst at Levin Capital Strategies producing institutional-caliber investment memos.

TOOLS: fetch_stock_price, fetch_sec_filing, store_portal. Use them IN ORDER.

PROCESS:
1. fetch_stock_price — get current price
2. fetch_sec_filing type=10-K — get financials, MD&A, risk factors
3. Analyze deeply — mispricing, catalysts, risks
4. Write comprehensive thesis with [10-K]/[Market]/[Consensus] source tags
5. store_portal — save with price target, direction, confidence

RULES:
- Tag every number: [10-K], [Market], [Consensus], [Computed]
- Name CEO, products, competitors, specific dollars
- Price target with Base (60%), Bull (25%), Bear (15%)
- "Not disclosed" if unknown — NEVER fabricate`;

const TOOLS: Anthropic.Tool[] = [
  { name: 'fetch_stock_price', description: 'Get current stock price, company name, 1-day change', input_schema: { type: 'object' as const, properties: { ticker: { type: 'string', description: 'Ticker (META, AAPL)' } }, required: ['ticker'] } },
  { name: 'fetch_sec_filing', description: 'Fetch 10-K or 10-Q from EDGAR', input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' }, filing_type: { type: 'string', enum: ['10-K', '10-Q'] } }, required: ['ticker', 'filing_type'] } },
  { name: 'store_portal', description: 'Save research to library', input_schema: { type: 'object' as const, properties: { ticker: { type: 'string' }, company: { type: 'string' }, direction: { type: 'string', enum: ['long', 'short'] }, price_target: { type: 'number' }, current_price: { type: 'number' }, confidence: { type: 'number', description: '0-100' }, summary: { type: 'string', description: '1-2 sentence BLUF' } }, required: ['ticker', 'company', 'direction', 'price_target', 'current_price', 'confidence', 'summary'] } },
];

export class ResearchAgent extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/research')) {
      const body = await request.json() as any;
      const ticker = String(body.ticker || '').toUpperCase().replace(/[^A-Z.]/g, '');
      if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 });
      try { return await this.runResearch(ticker); }
      catch (e) { return Response.json({ error: String(e).slice(0, 300) }, { status: 500 }); }
    }
    return new Response('Research Agent — POST /research {"ticker":"META"}');
  }

  async runResearch(ticker: string): Promise<Response> {
    const client = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: `Research ${ticker}. Use your tools to gather real data, then write a detailed investment thesis with a price target. Be thorough.` }];

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
            const cik = await getCik(String(args.ticker));
            if (!cik) result = { error: 'CIK not found' };
            else if (String(args.filing_type) === '10-K') {
              const f = await fetchLatest10K(cik.cik);
              result = f ? { url: f.url, date: f.date, mda: f.mda.slice(0, 15000), risks: f.risks.slice(0, 8000) } : { error: 'No 10-K' };
            } else {
              const f = await fetchLatest10Q(cik.cik);
              result = f ? { url: f.url, date: f.date, text: f.text.slice(0, 5000) } : { error: 'No 10-Q' };
            }
          } else if (block.name === 'store_portal') {
            const upside = args.current_price > 0 ? (args.price_target - args.current_price) / args.current_price : 0;
            const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
            await this.env.DB.prepare(`INSERT INTO portals (id,ticker,company,direction,rating,price_at_generation,price_target,upside_pct,confidence_index,summary,generated_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(ticker) DO UPDATE SET company=excluded.company,direction=excluded.direction,price_at_generation=excluded.price_at_generation,price_target=excluded.price_target,upside_pct=excluded.upside_pct,confidence_index=excluded.confidence_index,summary=excluded.summary,generated_at=excluded.generated_at`).bind(id, args.ticker, args.company, args.direction, args.direction === 'long' ? 'BUY' : 'SELL', args.current_price, args.price_target, upside, args.confidence, args.summary).run();
            result = { stored: true, ticker: args.ticker, confidence: args.confidence, upside: `${(upside * 100).toFixed(0)}%` };
          }
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
