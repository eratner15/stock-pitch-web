/**
 * Thin dispatcher for the equity-brief skill.
 *
 * The judgment (voice, structure, rules) lives in:
 *   src/skills/equity-brief/SKILL.md
 *
 * This file's job:
 *   1. Gather call data into template variables
 *   2. Render the skill markdown against those variables
 *   3. Split the skill into system (## Voice) + user (below the --- line)
 *   4. Call the model
 *   5. Fall back to a deterministic brief if the model misbehaves
 *
 * Per the three-layer principle: push intelligence UP into the skill,
 * push execution DOWN into deterministic code, keep this harness thin.
 */

import skillMarkdown from '../skills/equity-brief/SKILL.md';

interface BriefInput {
  ticker: string;
  company: string | null;
  direction: 'long' | 'short';
  rating: string;
  entry_price: number;
  price_target: number;
  time_horizon_months: number;
  thesis: string;
  display_name: string;
}

function buildVars(input: BriefInput): Record<string, string> {
  const impliedReturn = input.direction === 'long'
    ? ((input.price_target - input.entry_price) / input.entry_price) * 100
    : ((input.entry_price - input.price_target) / input.entry_price) * 100;

  return {
    ticker: input.ticker,
    company: input.company ?? '',
    company_suffix: input.company ? ` (${input.company})` : '',
    direction: input.direction,
    direction_upper: input.direction.toUpperCase(),
    rating: input.rating.toUpperCase(),
    entry_price: input.entry_price.toFixed(2),
    price_target: input.price_target.toFixed(2),
    implied_return: impliedReturn.toFixed(1),
    time_horizon_months: String(input.time_horizon_months),
    display_name: input.display_name,
    thesis: input.thesis.replace(/"/g, '\\"'),
  };
}

function substitute(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

/**
 * Parse the SKILL.md: extract system message (## Voice section) and user
 * message (everything after the first `---` rule below "The prompt" header).
 */
function parseSkill(md: string): { system: string; userTemplate: string } {
  // System = the "## Voice" section up to the next H2
  const voiceMatch = md.match(/## Voice\s+([\s\S]*?)(?=\n## )/);
  const system = voiceMatch
    ? voiceMatch[1].trim()
    : 'You are a senior equity research analyst. Be direct, specific, analytical.';

  // User prompt = everything after the `---\n\n` rule in the "The prompt" section
  const promptMatch = md.match(/## The prompt[\s\S]*?\n---\n\n([\s\S]+)$/);
  const userTemplate = promptMatch ? promptMatch[1].trim() : md;

  return { system, userTemplate };
}

export async function generateBrief(ai: any, input: BriefInput): Promise<string> {
  const vars = buildVars(input);
  const { system, userTemplate } = parseSkill(skillMarkdown as string);
  const userPrompt = substitute(userTemplate, vars);

  try {
    const response = await ai.run('@cf/google/gemma-4-26b-a4b-it', {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.65,
    });

    // Handle both OpenAI-compatible and legacy Workers AI response formats
    const text: string | undefined =
      response?.choices?.[0]?.message?.content ?? response?.response;

    if (!text || text.length < 200) {
      console.warn('AI brief too short or missing:', response);
      return fallbackBrief(input);
    }
    return text.trim();
  } catch (err) {
    console.error('AI brief generation failed:', err);
    return fallbackBrief(input);
  }
}

/**
 * Deterministic fallback — produces a usable brief with the user's thesis
 * front-and-center if the AI binding is unavailable. Not "intelligent" —
 * it's execution, so it lives here in the dispatcher, not in the skill.
 */
function fallbackBrief(input: BriefInput): string {
  const impliedReturn = input.direction === 'long'
    ? ((input.price_target - input.entry_price) / input.entry_price) * 100
    : ((input.entry_price - input.price_target) / input.entry_price) * 100;
  const dirWord = input.direction === 'long' ? 'long' : 'short';

  return `## The Setup

${input.display_name} is ${dirWord} ${input.ticker}${input.company ? ` (${input.company})` : ''} with a ${input.time_horizon_months}-month price target of $${input.price_target.toFixed(2)}, implying a ${impliedReturn.toFixed(1)}% return from entry at $${input.entry_price.toFixed(2)}. The thesis hinges on a specific variant perception relative to consensus — documented below in the analyst's own words.

## Variant Perception

The analyst's thesis, as submitted:

> ${input.thesis}

This is the proprietary view being tracked. Performance will be measured by forward price action against the $${input.price_target.toFixed(2)} target over the ${input.time_horizon_months}-month horizon.

## Key Catalysts

- The next earnings print is the primary near-term readout against the thesis
- Any shift in management guidance relative to Street consensus
- Sector-level data points (industry pricing, competitor results, regulatory developments) that confirm or challenge the analyst's framing

## Key Risks

- Macro regime change that compresses sector multiples broadly
- Company-specific execution failure that undermines the core thesis

## Valuation Framework

The $${input.price_target.toFixed(2)} target implies ${impliedReturn.toFixed(1)}% ${input.direction === 'long' ? 'upside' : 'downside'} from entry. Over the ${input.time_horizon_months}-month horizon, this represents an annualized ${(impliedReturn * 12 / input.time_horizon_months).toFixed(1)}% return. Entry price locked at $${input.entry_price.toFixed(2)} on the date of submission; current price will be tracked daily via the Stock Pitch leaderboard.`;
}
