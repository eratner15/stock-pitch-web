import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

let contract, rubric, normalization;
const original = JSON.parse(readFileSync('tests/fixtures/research-package.json', 'utf8'));
async function load(name) {
  const result = await build({ entryPoints: [`src/lib/${name}.ts`], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
before(async () => { [contract, rubric, normalization] = await Promise.all(['research-package', 'research-rubric', 'financial-facts'].map(load)); });

function fixture() {
  const p = structuredClone(original);
  p.judgment = {
    ...p.judgment,
    portfolio_action: 'not_assessed', limitations: 'Synthetic package; consensus is unavailable.',
    differentiated: false, consensus_unavailable_reason: 'No consensus snapshot supplied.',
    decision_summary: { text: 'Unrated pending further evidence.', fact_ids: ['fact-revenue'] },
    bear_case: { text: 'Revenue may not sustain the prior reported level.', fact_ids: ['fact-revenue'] },
    expectations: { text: 'Market-implied expectations are unresolved.', fact_ids: ['fact-revenue'] },
    variant_view: { text: 'Differentiation has not been established.', fact_ids: ['fact-revenue'] },
    thesis_pillars: [{ id: 'demand', claim: { text: 'Test whether revenue persists.', fact_ids: ['fact-revenue'] },
      counter_evidence: { text: 'One historical period is insufficient.', fact_ids: ['fact-revenue'] }, falsifier: 'Two consecutive revenue declines.' }],
    dated_tests: [{ id: 'demand-test', metric: 'Revenue', fact_ids: ['fact-revenue'], owner: 'analyst', next_check: '2026-04-01', falsifier: 'Two consecutive declines.' }],
  };
  return p;
}
function addSource(p, id, type, body) {
  const source = { ...structuredClone(p.sources[0]), source_id: id, source_type: type,
    document_title: 'Synthetic supporting observations', uri_or_file: `fixture://${id}`,
    published_at: '2025-12-30T00:00:00Z', checksum: createHash('sha256').update(body).digest('hex') };
  p.sources.push(source);
  return source;
}
function fact(p, id, overrides = {}) {
  const result = { ...structuredClone(p.facts[0]), fact_id: id, ...structuredClone(overrides) };
  p.facts.push(result);
  return result;
}
function analystFixture() {
  const p = fixture();
  addSource(p, 'report', 'licensed_research', 'Synthetic Analyst at Synthetic Bank: price target USD 100.');
  fact(p, 'analyst-name', { source_id: 'report', metric: 'analyst_name', unit: 'text', scale: 'unit', currency: null, value: null, raw_value: 'Synthetic Analyst' });
  fact(p, 'target', { source_id: 'report', metric: 'analyst_price_target', scale: 'unit', value: 100, raw_value: '100' });
  fact(p, 'firm', { source_id: 'report', metric: 'analyst_firm', unit: 'text', scale: 'unit', currency: null, value: null, raw_value: 'Synthetic Bank' });
  p.judgment.analyst_targets = [{ id: 'row', analyst: 'Synthetic Analyst', analyst_fact_id: 'analyst-name', target_fact_id: 'target', firm: 'Synthetic Bank', firm_fact_id: 'firm' }];
  return p;
}
function comparisonFixture(houseValue = 6) {
  const p = fixture();
  addSource(p, 'estimates', 'consensus_snapshot', 'Synthetic FY2027 EPS consensus USD 5 per share.');
  const period = { start: '2027-01-01', end: '2027-12-31', fiscal_year: 2027, kind: 'forecast', label: 'FY2027' };
  fact(p, 'consensus', { source_id: 'estimates', metric: 'eps', kind: 'consensus', value: 5, raw_value: '5', scale: 'unit', period });
  fact(p, 'house', { source_id: null, locator: null, metric: 'eps', kind: 'analyst_assumption', value: houseValue, raw_value: String(houseValue), scale: 'unit', period, rationale: 'Synthetic operating forecast.' });
  p.assumptions.push({ assumption_id: 'house-assumption', fact_id: 'house', rationale: 'Synthetic operating forecast.' });
  fact(p, 'delta', { source_id: null, locator: null, metric: 'eps_difference', kind: 'computed', value: houseValue - 5, raw_value: String(houseValue - 5), scale: 'unit', period, input_ids: ['house', 'consensus'] });
  p.judgment.consensus_comparisons = [{ id: 'eps-delta', house_fact_id: 'house', consensus_fact_id: 'consensus', delta_fact_id: 'delta' }];
  p.judgment.differentiated = houseValue !== 5;
  delete p.judgment.consensus_unavailable_reason;
  return p;
}
const check = p => rubric.validateResearchJudgment(contract.validateResearchPackage(p));
const codes = p => check(p).map(issue => issue.code);

test('review preserves an explicit unrated judgment and never derives a recommendation', () => {
  const p = fixture();
  assert.deepEqual(check(p), []);
  assert.equal(p.judgment.stance, 'unrated');
  p.judgment.stance = 'insufficient_evidence';
  assert.deepEqual(check(p), []);
  assert.ok(codes(original).includes('missing_claim'));
});

test('text facts require text units and cannot masquerade as missing numeric facts', () => {
  const p = analystFixture();
  assert.deepEqual(check(p), []);
  const name = p.facts.find(f => f.fact_id === 'analyst-name');
  assert.equal(normalization.normalizeFact(name).normalized_value, null);
  for (const change of [f => f.value = 10, f => f.raw_value = '', f => f.currency = 'USD', f => f.scale = 'million']) {
    const copy = structuredClone(p); change(copy.facts.find(f => f.fact_id === 'analyst-name'));
    assert.throws(() => contract.validateResearchPackage(copy));
  }
  p.facts[0].value = null;
  assert.ok(codes(p).includes('unresolved_fact'));
});

test('named analyst identity and target must resolve to the same verified dated report', () => {
  const p = analystFixture();
  for (const [expected, change] of [
    ['unsupported_analyst', p => p.judgment.analyst_targets[0].analyst = 'Invented Analyst'],
    ['analyst_report_mismatch', p => p.facts.find(f => f.fact_id === 'target').source_id = 'source-synthetic'],
    ['unverified_source', p => p.sources.find(s => s.source_id === 'report').quality_status = 'unresolved'],
    ['undated_source', p => p.sources.find(s => s.source_id === 'report').published_at = null],
    ['unsupported_firm', p => p.judgment.analyst_targets[0].firm = 'Invented Firm'],
    ['future_source', p => p.sources.find(s => s.source_id === 'report').published_at = '2026-02-01T00:00:00Z'],
  ]) {
    const copy = structuredClone(p); change(copy); assert.ok(codes(copy).includes(expected), expected);
  }
});

test('new rubric references are checked by the package schema before review', () => {
  const p = analystFixture();
  p.judgment.analyst_targets[0].analyst_fact_id = 'missing';
  assert.throws(() => contract.validateResearchPackage(p), /Unknown rubric fact/);
  const c = comparisonFixture(); c.judgment.consensus_comparisons[0].delta_fact_id = 'missing';
  assert.throws(() => contract.validateResearchPackage(c), /Unknown rubric fact/);
  const t = fixture(); t.judgment.dated_tests[0].fact_ids = ['missing'];
  assert.throws(() => contract.validateResearchPackage(t), /Unknown rubric fact/);
});

test('quantified comparison matches metric, dimensions, source kind and derived arithmetic', () => {
  const p = comparisonFixture();
  assert.deepEqual(check(p), []);
  for (const [expected, change] of [
    ['comparison_dimensions', p => p.facts.find(f => f.fact_id === 'house').period.fiscal_year = 2028],
    ['comparison_dimensions', p => p.facts.find(f => f.fact_id === 'house').currency = 'EUR'],
    ['comparison_dimensions', p => p.facts.find(f => f.fact_id === 'consensus').scale = 'million'],
    ['wrong_consensus_kind', p => p.sources.find(s => s.source_id === 'estimates').source_type = 'filing'],
    ['undated_source', p => p.sources.find(s => s.source_id === 'estimates').published_at = null],
    ['incorrect_delta', p => p.facts.find(f => f.fact_id === 'delta').value = 2],
    ['incorrect_delta', p => p.facts.find(f => f.fact_id === 'delta').input_ids = ['house']],
    ['unregistered_assumption', p => p.assumptions = []],
  ]) {
    const copy = structuredClone(p); change(copy); assert.ok(codes(copy).includes(expected), expected);
  }
});

test('consensus-aligned and unavailable cases cannot be called differentiated', () => {
  const aligned = comparisonFixture(5);
  assert.deepEqual(check(aligned), []);
  aligned.judgment.differentiated = true;
  assert.ok(codes(aligned).includes('consensus_aligned'));
  const unavailable = fixture(); unavailable.judgment.differentiated = true;
  assert.ok(codes(unavailable).includes('unsupported_differentiation'));
});

test('confirmed catalyst requires a typed source observation for the exact event and date', () => {
  const p = fixture();
  addSource(p, 'announcement', 'ir', 'Synthetic results are scheduled for April 1, 2026.');
  fact(p, 'event-date', { source_id: 'announcement', metric: 'event_date:results', unit: 'text', scale: 'unit', currency: null, value: null, raw_value: '2026-04-01' });
  p.judgment.catalysts = [{ id: 'results', description: 'Synthetic results', date: '2026-04-01', date_kind: 'confirmed', owner: 'analyst', falsifier: 'Revenue contracts.', source_ids: ['announcement'], date_fact_id: 'event-date' }];
  assert.deepEqual(check(p), []);
  for (const change of [p => p.judgment.catalysts[0].date = '2026-04-02', p => p.facts.find(f => f.fact_id === 'event-date').metric = 'event_date:unrelated', p => delete p.judgment.catalysts[0].date_fact_id]) {
    const copy = structuredClone(p); change(copy); assert.ok(codes(copy).includes('unconfirmed_event_date'));
  }
});

test('estimated dates require assumptions and unresolved timing cannot imply confirmation', () => {
  const p = fixture();
  p.judgment.catalysts = [{ id: 'review', description: 'Synthetic monitoring window', date: '2026-04-01', date_kind: 'estimated', owner: 'analyst', falsifier: 'Demand weakens.', source_ids: [] }];
  assert.ok(codes(p).includes('unexplained_estimate'));
  p.judgment.catalysts[0].estimate_basis = 'Analyst estimate based on prior cadence; not company-confirmed.';
  assert.deepEqual(check(p), []);
  p.judgment.catalysts[0].date_kind = 'unresolved';
  assert.ok(codes(p).includes('unresolved_date_has_value'));
});

test('directional stances require future horizon, confidence, supporting claims and owned tests', () => {
  const p = comparisonFixture(); p.judgment.stance = 'long';
  assert.ok(codes(p).includes('invalid_horizon'));
  assert.ok(codes(p).includes('missing_confidence'));
  p.judgment.valuation_horizon = '2027-01-01'; p.judgment.confidence = 'medium';
  assert.deepEqual(check(p), []);
  p.judgment.decision_summary.fact_ids = [];
  assert.ok(codes(p).includes('unsupported_claim'));
  p.judgment.dated_tests = [];
  assert.ok(codes(p).includes('missing_dated_tests'));
});

test('supporting facts from another security or unresolved source cannot substantiate a claim', () => {
  const p = fixture();
  p.sources[0].quality_status = 'partial';
  assert.ok(codes(p).includes('unverified_source'));
  const other = fixture(); other.securities.push({ ...structuredClone(other.securities[0]), security_id: 'other-security', exchange: 'XLON' });
  other.facts[0].security_id = 'other-security';
  assert.ok(codes(other).includes('wrong_identity'));
});

test('every portal primary and fallback system includes the same canonical rubric', () => {
  const source = readFileSync('src/lib/portal-generator.ts', 'utf8');
  assert.match(source, /const VOICE_SYSTEM = `\$\{RESEARCH_RUBRIC_PROMPT\}/);
  const fallbacks = [...source.matchAll(/system: ([^\n]+)/g)].map(match => match[1]).filter(value => !value.startsWith('string'));
  assert.equal(fallbacks.length, 4);
  assert.ok(fallbacks.every(value => value.startsWith('`${RESEARCH_RUBRIC_PROMPT}')));
  assert.doesNotMatch(source, /Each with specific calendar date|5-7 time-bound events with specific calendar dates|Name names: CEOs/);
});
