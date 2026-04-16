/**
 * WorkflowAgent — Generalized Durable Object for all research desk workflows.
 * Extends the ResearchAgent pattern with parameterized system prompts + tool sets.
 * Native Anthropic SDK (same as research-agent.ts).
 */
import { DurableObject } from 'cloudflare:workers';
import Anthropic from '@anthropic-ai/sdk';
import { fetchPrice } from '../lib/prices';
import { getCik, fetchLatest10K, fetchLatest10Q } from '../lib/edgar';
import {
  WORKFLOWS, TOOL_DEFS,
  type WorkflowSlug,
  isValidWorkflow,
} from '../lib/workflow-config';

const MAX_LOOPS = 15;

interface RunRequest {
  workflow: string;
  ticker?: string;
  context?: string;
  userId: string;
  runId: string;
}

interface ToolEvent {
  tool: string;
  args: string;
  result: string;
  ts: number;
}

export class WorkflowAgent extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // POST /run — start a workflow
    if (request.method === 'POST' && url.pathname.endsWith('/run')) {
      const body = await request.json() as RunRequest;
      if (!body.workflow || !isValidWorkflow(body.workflow)) {
        return Response.json({ error: `Invalid workflow: ${body.workflow}` }, { status: 400 });
      }
      const config = WORKFLOWS[body.workflow as WorkflowSlug];
      if (config.requiresTicker && !body.ticker) {
        return Response.json({ error: 'Ticker required for this workflow' }, { status: 400 });
      }
      try {
        return await this.runWorkflow(body, config);
      } catch (e) {
        return Response.json({ error: String(e).slice(0, 500) }, { status: 500 });
      }
    }

    // POST /stream — start workflow with SSE streaming
    if (request.method === 'POST' && url.pathname.endsWith('/stream')) {
      const body = await request.json() as RunRequest;
      if (!body.workflow || !isValidWorkflow(body.workflow)) {
        return Response.json({ error: `Invalid workflow: ${body.workflow}` }, { status: 400 });
      }
      const config = WORKFLOWS[body.workflow as WorkflowSlug];
      if (config.requiresTicker && !body.ticker) {
        return Response.json({ error: 'Ticker required for this workflow' }, { status: 400 });
      }
      return this.runWorkflowStreaming(body, config);
    }

    return new Response('WorkflowAgent — POST /run or /stream');
  }

  // -------------------------------------------------------------------
  // Non-streaming run (returns full JSON when complete)
  // -------------------------------------------------------------------
  private async runWorkflow(req: RunRequest, config: typeof WORKFLOWS[WorkflowSlug]): Promise<Response> {
    const start = Date.now();
    const client = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
    const ticker = req.ticker ? req.ticker.toUpperCase().replace(/[^A-Z.]/g, '') : undefined;

    const userPrompt = config.userPromptTemplate({ ticker, context: req.context });
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];
    const tools = config.tools.map(name => TOOL_DEFS[name]).filter(Boolean);

    let response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: config.maxTokens,
      system: config.systemPrompt,
      messages,
      tools,
    });

    const toolLog: ToolEvent[] = [];
    let loops = 0;

    while (response.stop_reason === 'tool_use' && loops < MAX_LOOPS) {
      loops++;
      const toolBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      const results = await Promise.all(toolBlocks.map(async (block) => {
        const result = await this.executeTool(block.name, block.input as any);
        toolLog.push({
          tool: block.name,
          args: JSON.stringify(block.input).slice(0, 120),
          result: JSON.stringify(result).slice(0, 200),
          ts: Date.now(),
        });
        return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(result) };
      }));

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: results });
      response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: config.maxTokens,
        system: config.systemPrompt,
        messages,
        tools,
      });
    }

    const finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    // Persist run to D1
    const duration = Date.now() - start;
    const summary = finalText.slice(0, 300).replace(/\n/g, ' ');
    try {
      await this.env.DB.prepare(
        `UPDATE workflow_runs SET status='complete', output_summary=?, output_json=?, tool_calls=?, tokens_used=?, duration_ms=?, completed_at=datetime('now') WHERE id=?`
      ).bind(summary, finalText, toolLog.length, response.usage?.output_tokens || 0, duration, req.runId).run();
    } catch (e) { /* non-fatal */ }

    return Response.json({
      ok: true,
      runId: req.runId,
      workflow: req.workflow,
      ticker,
      words: finalText.split(/\s+/).length,
      tool_loops: loops,
      tools_called: toolLog,
      analysis: finalText,
      duration_ms: duration,
      usage: response.usage,
    });
  }

  // -------------------------------------------------------------------
  // SSE streaming run (real-time tool progress + final output)
  // -------------------------------------------------------------------
  private runWorkflowStreaming(req: RunRequest, config: typeof WORKFLOWS[WorkflowSlug]): Response {
    const encoder = new TextEncoder();
    const agent = this;

    const stream = new ReadableStream({
      async start(controller) {
        function send(event: string, data: any) {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        }

        try {
          const start = Date.now();
          const client = new Anthropic({ apiKey: agent.env.ANTHROPIC_API_KEY });
          const ticker = req.ticker ? req.ticker.toUpperCase().replace(/[^A-Z.]/g, '') : undefined;
          const userPrompt = config.userPromptTemplate({ ticker, context: req.context });
          const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];
          const tools = config.tools.map(name => TOOL_DEFS[name]).filter(Boolean);

          send('start', { workflow: req.workflow, ticker, runId: req.runId });

          let response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: config.maxTokens,
            system: config.systemPrompt,
            messages,
            tools,
          });

          const toolLog: ToolEvent[] = [];
          let loops = 0;

          while (response.stop_reason === 'tool_use' && loops < MAX_LOOPS) {
            loops++;
            const toolBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

            // Notify client about each tool call
            for (const block of toolBlocks) {
              send('tool_start', { tool: block.name, args: block.input, loop: loops });
            }

            const results = await Promise.all(toolBlocks.map(async (block) => {
              const result = await agent.executeTool(block.name, block.input as any);
              const event: ToolEvent = {
                tool: block.name,
                args: JSON.stringify(block.input).slice(0, 120),
                result: JSON.stringify(result).slice(0, 200),
                ts: Date.now(),
              };
              toolLog.push(event);
              send('tool_done', { tool: block.name, preview: JSON.stringify(result).slice(0, 150), loop: loops });
              return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(result) };
            }));

            messages.push({ role: 'assistant', content: response.content });
            messages.push({ role: 'user', content: results });

            send('thinking', { loop: loops + 1, message: 'Analyzing data...' });
            response = await client.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: config.maxTokens,
              system: config.systemPrompt,
              messages,
              tools,
            });
          }

          const finalText = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map(b => b.text)
            .join('\n');

          // Persist to D1
          const duration = Date.now() - start;
          const summary = finalText.slice(0, 300).replace(/\n/g, ' ');
          try {
            await agent.env.DB.prepare(
              `UPDATE workflow_runs SET status='complete', output_summary=?, output_json=?, tool_calls=?, tokens_used=?, duration_ms=?, completed_at=datetime('now') WHERE id=?`
            ).bind(summary, finalText, toolLog.length, response.usage?.output_tokens || 0, duration, req.runId).run();
          } catch (e) { /* non-fatal */ }

          send('complete', {
            runId: req.runId,
            words: finalText.split(/\s+/).length,
            tool_loops: loops,
            duration_ms: duration,
            analysis: finalText,
          });
        } catch (e) {
          send('error', { message: String(e).slice(0, 500) });
          try {
            await agent.env.DB.prepare(
              `UPDATE workflow_runs SET status='failed', error_message=?, completed_at=datetime('now') WHERE id=?`
            ).bind(String(e).slice(0, 500), req.runId).run();
          } catch (_) { /* non-fatal */ }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // -------------------------------------------------------------------
  // Tool Execution — shared across all workflows
  // -------------------------------------------------------------------
  private async executeTool(name: string, args: any): Promise<any> {
    try {
      switch (name) {
        case 'fetch_stock_price': {
          const q = await fetchPrice(String(args.ticker));
          return q
            ? { ticker: q.ticker, price: q.price, company: q.company, change_1d: q.change_1d, as_of: q.as_of }
            : { error: `Cannot price ${args.ticker}` };
        }
        case 'fetch_sec_filing': {
          const cik = await getCik(String(args.ticker));
          if (!cik) return { error: `CIK not found for ${args.ticker}` };
          if (String(args.filing_type) === '10-K') {
            const f = await fetchLatest10K(cik.cik);
            return f
              ? { url: f.url, date: f.date, mda: f.mda.slice(0, 15000), risks: f.risks.slice(0, 8000) }
              : { error: 'No 10-K found' };
          } else {
            const f = await fetchLatest10Q(cik.cik);
            return f
              ? { url: f.url, date: f.date, text: f.text.slice(0, 5000) }
              : { error: 'No 10-Q found' };
          }
        }
        case 'store_result': {
          // Handled by the caller — the DO persists via UPDATE on workflow_runs
          return { stored: true, summary: String(args.summary).slice(0, 200) };
        }
        case 'get_lb_positions': {
          // Read from cached LB positions in D1
          const account = args.account ? String(args.account) : null;
          const query = account
            ? `SELECT * FROM lb_positions_cache WHERE axys_code = ? ORDER BY market_value DESC LIMIT 50`
            : `SELECT * FROM lb_positions_cache ORDER BY market_value DESC LIMIT 50`;
          const stmt = account
            ? this.env.DB.prepare(query).bind(account)
            : this.env.DB.prepare(query);
          const { results } = await stmt.all();
          if (!results || results.length === 0) {
            return { error: 'No portfolio data available. LiquidityBook positions not yet synced.' };
          }
          return {
            positions: results,
            count: results.length,
            as_of: (results[0] as any)?.synced_at || 'unknown',
          };
        }
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (e) {
      return { error: String(e).slice(0, 300) };
    }
  }
}
