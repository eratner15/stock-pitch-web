/**
 * Generates a ~500-word research brief supporting a user's thesis.
 * Uses Gemma 4 on Cloudflare Workers AI (native binding, no external API).
 *
 * CRITICAL: Gemma 4 26B via Workers AI returns OpenAI-compatible format:
 *   { choices: [{ message: { content: "..." } }] }
 * NOT the legacy { response: "..." } format.
 */

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

export async function generateBrief(ai: any, input: BriefInput): Promise<string> {
  const impliedReturn = input.direction === 'long'
    ? ((input.price_target - input.entry_price) / input.entry_price) * 100
    : ((input.entry_price - input.price_target) / input.entry_price) * 100;

  const systemPrompt = `You are a senior equity research analyst writing a concise, institutional-grade research brief. Institutional tone: direct, specific, analytical. No hype, no exclamation points, no promotional language. Write like Matt Levine meets Credit Suisse. Cite the specific variant perception. Always 450-550 words.`;

  const userPrompt = `Write a 500-word research brief supporting this investment call.

**The Call:**
- Ticker: ${input.ticker}${input.company ? ` (${input.company})` : ''}
- Direction: ${input.direction.toUpperCase()}
- Rating: ${input.rating.toUpperCase()}
- Entry price: $${input.entry_price.toFixed(2)}
- Price target: $${input.price_target.toFixed(2)}
- Implied return: ${impliedReturn.toFixed(1)}%
- Time horizon: ${input.time_horizon_months} months
- Analyst: ${input.display_name}

**Analyst's thesis (verbatim):**
"${input.thesis}"

**Structure the brief as follows:**

## The Setup
Two sentences. What is the market currently pricing, and what does ${input.display_name} see differently?

## Variant Perception
A single paragraph on the specific mispricing. Be concrete about what the Street has wrong. Reference any known segment economics, consensus estimates, or industry dynamics that make the case.

## Key Catalysts
Three specific, time-bound catalysts that could close the gap between $${input.entry_price.toFixed(2)} and $${input.price_target.toFixed(2)}. Use bullet format.

## Key Risks
Two specific risks that could invalidate the thesis. Honest, not throwaway. Use bullet format.

## Valuation Framework
One paragraph: what multiple, on what earnings base, gets to the price target? If this is a sum-of-parts, asset-value, or DCF setup, name it explicitly.

Rules:
- Never invent specific financial numbers you don't know. If unsure, use approximate ranges or say "approximately."
- Do not write a preamble or closing. Just the five sections.
- Markdown formatting with ## headers.
- 450-550 words total.
- Write in third person about ${input.display_name}'s thesis. Do not address the reader as "you."`;

  try {
    const response = await ai.run('@cf/google/gemma-4-26b-a4b-it', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.65,
    });

    // Handle both OpenAI-format and legacy Workers AI format
    let text: string | undefined;
    if (response?.choices?.[0]?.message?.content) {
      text = response.choices[0].message.content;
    } else if (response?.response) {
      text = response.response;
    }

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
 * Deterministic fallback if AI is unavailable — still produces a usable brief
 * with the user's thesis front and center.
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
