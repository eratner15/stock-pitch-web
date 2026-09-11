import { z } from 'zod';
import type { FinancialFact, ResearchPackage } from './research-package';

const id = z.string().min(1).max(160);
const text = z.string().trim().min(1).max(2000);
const claim = z.object({ text: text.nullable(), fact_ids: z.array(id) }).strict();

/** Drafts may be incomplete. validateResearchJudgment applies the review gate. */
export const researchJudgmentSchema = z.object({
  stance: z.enum(['unrated', 'watch', 'long', 'short', 'insufficient_evidence']),
  confidence: z.enum(['low', 'medium', 'high']).nullable(),
  valuation_horizon: text.nullable(),
  decision_summary: claim,
  what_changed: claim,
  bear_case: claim,
  expectations: claim,
  variant_view: claim,
  thesis_pillars: z.array(z.object({ id, claim, counter_evidence: claim, falsifier: text.nullable() }).strict()),
  catalysts: z.array(z.object({
    id, description: text, date: z.iso.date().nullable(),
    date_kind: z.enum(['confirmed', 'estimated', 'unresolved']),
    owner: id.nullable(), falsifier: text.nullable(), source_ids: z.array(id),
    date_fact_id: id.optional(), estimate_basis: text.optional(),
  }).strict()),
  portfolio_action: z.enum(['not_assessed', 'watch', 'review_required']).optional(),
  limitations: text.optional(),
  differentiated: z.boolean().optional(),
  consensus_unavailable_reason: text.optional(),
  consensus_comparisons: z.array(z.object({
    id, house_fact_id: id, consensus_fact_id: id, delta_fact_id: id,
  }).strict()).optional(),
  analyst_targets: z.array(z.object({
    id, analyst: text, analyst_fact_id: id, target_fact_id: id,
    firm: text.optional(), firm_fact_id: id.optional(),
  }).strict()).optional(),
  dated_tests: z.array(z.object({
    id, metric: text, fact_ids: z.array(id).min(1), owner: id,
    next_check: z.iso.date(), falsifier: text,
  }).strict()).optional(),
}).strict();

export interface ResearchJudgmentIssue { code: string; path: string; message: string }

export const RESEARCH_RUBRIC_PROMPT = `LCS RESEARCH RUBRIC (applies to every section, JSON response and retry):
- State the strongest bear case, what is priced in, and a falsifier. Use only supplied evidence; bracket labels alone do not establish a source.
- Named analysts, firms and price targets require a dated verified report and precise source locator. Never approximate, soften or invent an attribution. Omit unavailable individual rows.
- Compare house and consensus only for the same metric, currency, scale, period and accounting basis. Show the quantified difference. If consensus is missing, state unavailable; if aligned, state aligned. Never manufacture mispricing or a beat/miss.
- Confirmed catalyst dates require a source for that exact event and date. Label assumptions as estimated, with their basis. If timing is unknown, state unresolved; never invent calendar dates to fill a quota.
- Give dated thesis tests with an owner, metric and falsifier. Separate these analyst review dates from confirmed company events.
- Keep stance, confidence, valuation horizon and portfolio action separate. Preserve unrated and insufficient-evidence outcomes. No fixed upside/downside threshold assigns a recommendation, and no model output authorizes a trade.
- Targets, scenario probabilities and estimates need an explicit model/assumption basis. Missing values stay missing; output length, tables, dates and fact-count requests never justify fabricated content.`;

/** Checks referenced observations, not source truth or independent approval. */
export function validateResearchJudgment(pkg: ResearchPackage): ResearchJudgmentIssue[] {
  const parsed = researchJudgmentSchema.safeParse(pkg.judgment);
  if (!parsed.success) return parsed.error.issues.map(issue => ({ code: 'judgment_schema', path: `judgment.${issue.path.join('.')}`, message: issue.message }));
  const judgment = parsed.data;
  const issues: ResearchJudgmentIssue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  const facts = new Map(pkg.facts.map(fact => [fact.fact_id, fact]));
  const sources = new Map(pkg.sources.map(source => [source.source_id, source]));
  const asOf = Date.parse(pkg.analysis_as_of);
  const validDate = (value: string | null) => z.iso.date().safeParse(value).success;
  const sourceProblems = (fact: FinancialFact, path: string, dated = false) => {
    const source = fact.source_id ? sources.get(fact.source_id) : undefined;
    if (!source || source.quality_status !== 'verified_source' || !fact.locator || !source.retrieved_at) {
      add('unverified_source', path, 'Claim requires a verified source, retrieval timestamp and fact locator.');
      return undefined;
    }
    if (Date.parse(source.retrieved_at) > asOf || source.published_at && Date.parse(source.published_at) > asOf) {
      add('future_source', path, 'Source was not available at the package analysis time.');
      return undefined;
    }
    if (dated && !source.published_at) {
      add('undated_source', path, 'Analyst attribution and event confirmation require a dated source.');
      return undefined;
    }
    return source;
  };
  const support = (factId: string, path: string, visiting = new Set<string>()): FinancialFact | undefined => {
    const fact = facts.get(factId);
    if (!fact) { add('unknown_fact', path, `Unknown supporting fact: ${factId}`); return undefined; }
    if (fact.company_id !== pkg.company_id || fact.security_id && fact.security_id !== pkg.security_id) {
      add('wrong_identity', path, 'Supporting fact belongs to another issuer or security.');
    }
    if (visiting.has(factId)) { add('fact_cycle', path, 'Supporting fact dependency cycle.'); return undefined; }
    if (fact.kind === 'unresolved' || fact.value === null && (fact.unit !== 'text' || !fact.raw_value?.trim())) {
      add('unresolved_fact', path, 'Unresolved or missing observations cannot substantiate a judgment.');
    } else if (fact.kind === 'computed') {
      if (!fact.input_ids.length) add('missing_inputs', path, 'Computed support needs input references.');
      const next = new Set(visiting).add(factId);
      for (const input of fact.input_ids) support(input, path, next);
    } else if (fact.kind === 'analyst_assumption') {
      if (!fact.rationale || !pkg.assumptions.some(item => item.fact_id === factId)) add('unregistered_assumption', path, 'House assumptions need rationale and an assumption-ledger entry.');
    } else sourceProblems(fact, path);
    return fact;
  };
  const checkClaim = (value: z.infer<typeof claim>, path: string, required: boolean) => {
    if (required && !value.text) add('missing_claim', path, 'A reviewable judgment requires explicit text.');
    if (value.text && !value.fact_ids.length) add('unsupported_claim', path, 'A populated judgment claim requires supporting fact IDs.');
    for (const factId of value.fact_ids) support(factId, path);
  };
  for (const key of ['decision_summary', 'bear_case', 'expectations', 'variant_view'] as const) checkClaim(judgment[key], `judgment.${key}`, true);
  checkClaim(judgment.what_changed, 'judgment.what_changed', pkg.workflow === 'refresh' || pkg.workflow === 'earnings_recap');
  if (!judgment.portfolio_action) add('missing_action_posture', 'judgment.portfolio_action', 'Portfolio action must be explicit and separate from stance.');
  if (judgment.stance === 'long' || judgment.stance === 'short') {
    if (!validDate(judgment.valuation_horizon) || judgment.valuation_horizon! <= pkg.analysis_as_of.slice(0, 10)) add('invalid_horizon', 'judgment.valuation_horizon', 'Directional stance requires a future ISO valuation-horizon date.');
    if (!judgment.confidence) add('missing_confidence', 'judgment.confidence', 'Directional stance requires explicit confidence.');
  } else if (['unrated', 'insufficient_evidence'].includes(judgment.stance) && !judgment.limitations) {
    add('missing_limitations', 'judgment.limitations', 'Unrated or insufficient-evidence outcomes must explain missing evidence.');
  }
  for (const [index, pillar] of judgment.thesis_pillars.entries()) {
    checkClaim(pillar.claim, `judgment.thesis_pillars.${index}.claim`, true);
    checkClaim(pillar.counter_evidence, `judgment.thesis_pillars.${index}.counter_evidence`, true);
    if (!pillar.falsifier) add('missing_falsifier', `judgment.thesis_pillars.${index}`, 'Every thesis pillar needs a falsifier.');
  }
  if (!judgment.thesis_pillars.length) add('missing_pillars', 'judgment.thesis_pillars', 'At least one falsifiable thesis pillar is required.');
  const tests = judgment.dated_tests ?? [];
  if (!tests.length) add('missing_dated_tests', 'judgment.dated_tests', 'At least one owned, dated thesis test is required.');
  for (const [index, test] of tests.entries()) {
    for (const factId of test.fact_ids) support(factId, `judgment.dated_tests.${index}`);
    if (test.next_check < pkg.analysis_as_of.slice(0, 10)) add('past_next_check', `judgment.dated_tests.${index}`, 'Next-check date precedes the analysis date.');
  }
  const comparisons = judgment.consensus_comparisons ?? [];
  if (typeof judgment.differentiated !== 'boolean') add('missing_differentiation', 'judgment.differentiated', 'State whether the thesis is differentiated.');
  if (!comparisons.length) {
    if (!judgment.consensus_unavailable_reason) add('missing_consensus_comparison', 'judgment.consensus_comparisons', 'Provide a quantified comparison or explain unavailable consensus.');
    if (judgment.differentiated) add('unsupported_differentiation', 'judgment.differentiated', 'Missing consensus cannot establish a differentiated thesis.');
  }
  let hasDifference = false;
  const dimensionsMatch = (left: FinancialFact, right: FinancialFact, includeMetric = true) =>
    (!includeMetric || left.metric === right.metric) && ['company_id', 'security_id', 'unit', 'scale', 'currency', 'segment', 'accounting_basis'].every(key => left[key as keyof FinancialFact] === right[key as keyof FinancialFact]) &&
    ['start', 'end', 'kind', 'fiscal_year'].every(key => left.period[key as keyof FinancialFact['period']] === right.period[key as keyof FinancialFact['period']]);
  for (const [index, comparison] of comparisons.entries()) {
    const path = `judgment.consensus_comparisons.${index}`;
    const house = support(comparison.house_fact_id, path), consensus = support(comparison.consensus_fact_id, path), delta = support(comparison.delta_fact_id, path);
    if (!house || !consensus || !delta) continue;
    sourceProblems(consensus, path, true);
    if (consensus.kind !== 'consensus' || sources.get(consensus.source_id ?? '')?.source_type !== 'consensus_snapshot') add('wrong_consensus_kind', path, 'Consensus comparison requires an actual consensus snapshot fact.');
    if (!['analyst_assumption', 'computed'].includes(house.kind)) add('wrong_house_kind', path, 'House estimate must be a registered assumption or computed fact.');
    if (!dimensionsMatch(house, consensus) || !dimensionsMatch(house, delta, false)) add('comparison_dimensions', path, 'Comparison must use identical metric, issuer, currency, scale, period, segment and accounting basis.');
    if (house.value === null || consensus.value === null || delta.value === null) { add('missing_comparison_value', path, 'Quantified comparison requires three numeric observations.'); continue; }
    const difference = house.value - consensus.value;
    const tolerance = 1e-9 * Math.max(1, Math.abs(difference));
    if (delta.kind !== 'computed' || !delta.input_ids.includes(house.fact_id) || !delta.input_ids.includes(consensus.fact_id) || Math.abs(delta.value - difference) > tolerance) add('incorrect_delta', path, 'Difference fact must reference house and consensus and equal house minus consensus.');
    if (Math.abs(difference) > tolerance) hasDifference = true;
  }
  if (comparisons.length && judgment.differentiated && !hasDifference) add('consensus_aligned', 'judgment.differentiated', 'Consensus-aligned comparisons cannot be labeled differentiated.');
  for (const [index, row] of (judgment.analyst_targets ?? []).entries()) {
    const path = `judgment.analyst_targets.${index}`;
    const name = support(row.analyst_fact_id, path), target = support(row.target_fact_id, path);
    if (!name || !target) continue;
    const source = sourceProblems(name, path, true);
    sourceProblems(target, path, true);
    if (name.metric !== 'analyst_name' || name.unit !== 'text' || name.raw_value?.trim() !== row.analyst || name.kind !== 'reported_actual') add('unsupported_analyst', path, 'Analyst name must match a source-located textual analyst_name observation.');
    if (!source || source.source_type !== 'licensed_research' || name.source_id !== target.source_id) add('analyst_report_mismatch', path, 'Name and target must come from the same verified analyst report.');
    if (target.metric !== 'analyst_price_target' || target.kind !== 'reported_actual' || target.value === null || target.unit !== 'currency' || target.scale !== 'unit' || !target.currency) add('unsupported_target', path, 'Target must be an observed monetary analyst_price_target, not an estimate.');
    if (row.firm) {
      const firm = row.firm_fact_id ? support(row.firm_fact_id, path) : undefined;
      if (!firm || firm.metric !== 'analyst_firm' || firm.unit !== 'text' || firm.raw_value?.trim() !== row.firm || firm.source_id !== name.source_id || firm.kind !== 'reported_actual') add('unsupported_firm', path, 'Analyst firm requires its own matching observation from the same report.');
    }
  }
  for (const [index, event] of judgment.catalysts.entries()) {
    const path = `judgment.catalysts.${index}`;
    if (event.date_kind === 'confirmed') {
      const fact = event.date_fact_id ? support(event.date_fact_id, path) : undefined;
      const source = fact ? sourceProblems(fact, path, true) : undefined;
      if (!fact || !source || !['filing', 'ir', 'transcript'].includes(source.source_type) || !event.source_ids.includes(source.source_id) || fact.metric !== `event_date:${event.id}` || fact.unit !== 'text' || fact.raw_value !== event.date || fact.kind !== 'reported_actual') add('unconfirmed_event_date', path, 'Confirmed date needs a dated verified event_date:<eventId> observation for that event.');
    } else if (event.date_kind === 'estimated') {
      if (!event.date || !event.estimate_basis) add('unexplained_estimate', path, 'Estimated catalyst dates require an explicit assumption basis.');
    } else if (event.date) add('unresolved_date_has_value', path, 'Unresolved timing must not contain a calendar date.');
  }
  return issues;
}
