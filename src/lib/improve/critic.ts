/**
 * Portal memo critic — scores a generated memo against a rubric derived
 * from the hand-crafted /amzn/ gold standard. Karpathy-style loop:
 *
 *   generate → critique → log → propose prompt edits → regenerate → repeat
 *
 * The critic is deterministic where possible (section word counts, source
 * tag density, sidenote count, named entity checks) and uses an LLM only
 * for the "is this actually specific / institutional / argumentative"
 * judgment. That keeps the loop fast and the scoring reproducible.
 */

export interface SectionScore {
  id: string;
  label: string;
  target_words: number;
  actual_words: number;
  source_tags: number;
  sidenotes: number;
  ok: boolean;
  pass_reason: string;
}

export interface CritiqueReport {
  ticker: string;
  generated_at: string;
  total_words: number;
  total_source_tags: number;
  total_sidenotes: number;
  total_h2: number;
  sections: SectionScore[];
  density_score: number;           // source tags per 1000 words
  depth_score: number;              // fraction of sections hitting word target
  specificity_score: number;        // fraction hitting sidenote target
  overall_score: number;            // 0-100 composite
  pass_fail: 'PASS' | 'FAIL' | 'PARTIAL';
  llm_feedback: string;             // free-text from the critic LLM
  fix_recommendations: string[];    // ordered list of concrete changes
}

const TARGETS: Record<string, { label: string; target_words: number; target_tags: number; target_sidenotes: number }> = {
  'exec-summary':   { label: 'Executive Summary',     target_words: 500, target_tags: 5, target_sidenotes: 1 },
  'business':       { label: 'Business Overview',     target_words: 800, target_tags: 8, target_sidenotes: 2 },
  'situation':      { label: 'Situation',              target_words: 500, target_tags: 4, target_sidenotes: 1 },
  'complication':   { label: 'Complication',           target_words: 500, target_tags: 4, target_sidenotes: 1 },
  'support-1':      { label: 'Support #1',             target_words: 900, target_tags: 15, target_sidenotes: 3 },
  'support-2':      { label: 'Support #2',             target_words: 900, target_tags: 15, target_sidenotes: 3 },
  'support-3':      { label: 'Support #3',             target_words: 900, target_tags: 15, target_sidenotes: 3 },
  'competitive':    { label: 'Competitive Landscape',  target_words: 800, target_tags: 8, target_sidenotes: 2 },
  'bridge':         { label: 'Revenue/Earnings Bridge',target_words: 800, target_tags: 10, target_sidenotes: 2 },
  'sotp':           { label: 'Sum-of-Parts',           target_words: 900, target_tags: 10, target_sidenotes: 3 },
  'mgmt':           { label: 'Management',             target_words: 700, target_tags: 6, target_sidenotes: 2 },
  'risks':          { label: 'Key Risks',              target_words: 800, target_tags: 5, target_sidenotes: 2 },
  'valuation':      { label: 'Valuation',              target_words: 800, target_tags: 6, target_sidenotes: 2 },
  'price-target':   { label: 'Price Target',           target_words: 600, target_tags: 4, target_sidenotes: 1 },
  'catalysts':      { label: 'Catalysts',              target_words: 700, target_tags: 4, target_sidenotes: 1 },
};

export async function critiquePortal(
  ai: any,
  ticker: string,
  memoHtml: string
): Promise<CritiqueReport> {
  const sections: SectionScore[] = [];
  let totalWords = 0;
  let totalTags = 0;
  let totalSidenotes = 0;

  for (const id of Object.keys(TARGETS)) {
    const target = TARGETS[id];
    const text = extractSectionText(memoHtml, id);
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const tags = (text.match(/\[[A-Za-z0-9\-]+\]/g) || []).length;
    const sidenotes = (memoHtml.match(new RegExp(`memo-sidenote[^>]*>`, 'g')) || []).length;

    const pass = words >= Math.floor(target.target_words * 0.7) &&
                 tags >= Math.floor(target.target_tags * 0.5);
    const reason = words < target.target_words * 0.5
      ? `FAIL — only ${words} words (target ${target.target_words}). Section may be returning 'pending' fallback.`
      : words < target.target_words * 0.8
      ? `PARTIAL — ${words} words vs ${target.target_words} target. Worth a second pass.`
      : tags < target.target_tags * 0.5
      ? `WEAK — ${tags} source tags vs ${target.target_tags} target. Prompt needs to demand more [10-K] citations.`
      : `OK — ${words}w / ${tags} tags, meeting targets.`;

    sections.push({
      id, label: target.label,
      target_words: target.target_words,
      actual_words: words,
      source_tags: tags,
      sidenotes: 0, // computed globally below
      ok: pass,
      pass_reason: reason,
    });
    totalWords += words;
    totalTags += tags;
  }

  totalSidenotes = (memoHtml.match(/memo-sidenote/g) || []).length;
  const h2Count = (memoHtml.match(/<h2\b/g) || []).length;

  const density_score = totalWords > 0 ? (totalTags / totalWords) * 1000 : 0;
  const depth_score = sections.filter(s => s.actual_words >= TARGETS[s.id].target_words * 0.7).length / sections.length;
  const specificity_score = totalSidenotes >= 20 ? 1 : totalSidenotes / 20;
  // Composite: depth (40%) + density (30%) + specificity (30%)
  // Density target: 10+ tags per 1000 words is institutional
  const densityFactor = Math.min(1, density_score / 10);
  const overall_score = Math.round((depth_score * 40 + densityFactor * 30 + specificity_score * 30));
  const pass_fail: 'PASS' | 'FAIL' | 'PARTIAL' =
    overall_score >= 80 ? 'PASS' : overall_score >= 55 ? 'PARTIAL' : 'FAIL';

  // LLM qualitative feedback — one call, takes a sample of the prose
  const proseSample = sections
    .filter(s => s.actual_words >= 400)
    .slice(0, 3)
    .map(s => extractSectionText(memoHtml, s.id).slice(0, 1500))
    .join('\n\n---\n\n');
  const llm_feedback = await runCritic(ai, ticker, proseSample, sections);

  // Prioritized fix list
  const fix_recommendations = buildFixList(sections, totalSidenotes, density_score, llm_feedback);

  return {
    ticker,
    generated_at: new Date().toISOString(),
    total_words: totalWords,
    total_source_tags: totalTags,
    total_sidenotes: totalSidenotes,
    total_h2: h2Count,
    sections,
    density_score,
    depth_score,
    specificity_score,
    overall_score,
    pass_fail,
    llm_feedback,
    fix_recommendations,
  };
}

function extractSectionText(html: string, id: string): string {
  const re = new RegExp(`id="${id}"[^>]*>[\\s\\S]*?(?=<h2|<section|<footer)`, 'i');
  const m = html.match(re);
  if (!m) return '';
  // Strip HTML tags and collapse whitespace
  return m[0]
    .replace(/<aside class="memo-sidenote"[^>]*>[\s\S]*?<\/aside>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function runCritic(ai: any, ticker: string, proseSample: string, sections: SectionScore[]): Promise<string> {
  if (!proseSample) return 'No substantial prose generated — sections mostly empty.';
  const weakSections = sections.filter(s => !s.ok).map(s => s.label).join(', ');
  const sys = `You are a senior sell-side equity research director. Given a sample of an auto-generated investment memo, identify the TOP 3-5 specific problems with specificity, voice, and density. Rank by severity. Be concrete — reference actual phrases from the prose. Output plain text, one problem per numbered line. Keep under 400 words.`;
  const user = `TICKER: ${ticker}
SECTIONS THAT FAILED WORD TARGETS: ${weakSections || 'none'}

PROSE SAMPLE:
${proseSample}

What are the 3-5 biggest concrete problems with this output vs. institutional research standards? Focus on: specificity (generic claims vs sourced numbers), voice (analyst vs filler), citation density, hallucination risk.`;

  try {
    const res = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
      max_tokens: 1200,
      temperature: 0.3,
    });
    const text = res?.choices?.[0]?.message?.content ?? res?.response ?? '';
    return typeof text === 'string' ? text.trim() : '';
  } catch (err) {
    return `Critic LLM failed: ${String(err).slice(0, 200)}`;
  }
}

function buildFixList(
  sections: SectionScore[],
  totalSidenotes: number,
  density_score: number,
  llmFeedback: string
): string[] {
  const fixes: string[] = [];
  const empty = sections.filter(s => s.actual_words < 200);
  if (empty.length > 0) {
    fixes.push(
      `CRITICAL: ${empty.length} sections returned empty (${empty.map(s => s.label).join(', ')}). ` +
      `Likely Workers AI concurrency glitch or JSON parse failure. ` +
      `Convert those calls to plain-markdown mode OR retry just those sections.`
    );
  }
  const shallow = sections.filter(s => s.actual_words >= 200 && s.actual_words < TARGETS[s.id].target_words * 0.7);
  if (shallow.length > 0) {
    fixes.push(
      `DEPTH: ${shallow.length} sections below word target — ${shallow.map(s => `${s.label} (${s.actual_words}w)`).join(', ')}. ` +
      `Raise max_tokens on those calls to 4000+ and make the word target more explicit in the system prompt.`
    );
  }
  if (density_score < 7) {
    fixes.push(
      `DENSITY: ${density_score.toFixed(1)} source tags per 1000 words (target 10+). ` +
      `Prompt should demand "1 source tag per sentence" and "every number must carry a bracketed tag".`
    );
  }
  if (totalSidenotes < 15) {
    fixes.push(
      `SIDENOTES: ${totalSidenotes} total (target 20+). ` +
      `Increase sidenote demand in per-section prompts to 3-4 per deep section.`
    );
  }
  // Parse the LLM feedback for any new concrete issues not covered above
  const llmLines = llmFeedback.split('\n').filter(l => /^\d+\.\s*/.test(l));
  if (llmLines.length > 0) {
    fixes.push(`QUALITY FROM LLM CRITIC:\n${llmLines.slice(0, 5).join('\n')}`);
  }
  return fixes;
}
