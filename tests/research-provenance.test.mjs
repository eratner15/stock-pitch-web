import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
let p, prices;
async function load(path) {
  const result = await build({entryPoints:[path], bundle:true, write:false, format:'esm', platform:'node'});
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
before(async () => { p = await load('src/lib/research-provenance.ts'); prices = await load('src/lib/prices.ts'); });
test('absent, empty and malformed metadata remains unresolved; zero survives', () => {
  for (const value of [undefined, null, '', '   ', false, 0, {}, [], 'unknown']) {
    assert.equal(p.normalizeRating(value), 'Unrated');
    assert.equal(p.normalizeSource(value), 'Source unresolved');
  }
  assert.equal(p.normalizeRating('invented rating'), 'Unrated');
  for (const value of ['[object Object]', 'garbage', '<script>', '[10-K']) assert.equal(p.normalizeSource(value), 'Source unresolved');
  assert.equal(p.normalizeRating(null, ' hold '), 'HOLD');
  assert.equal(p.normalizeSource(' [10-K] '), '[10-K]');
  assert.deepEqual(p.normalizeMetric({label:'Debt',value:0}), {label:'Debt',value:'0',source:'Source unresolved'});
  assert.equal(p.normalizeMetric({label:'Debt'}).value, '—');
  assert.equal(p.normalizeMetric(null), null);
});
test('publication rejects unresolved metadata and unavailable cited filings', () => {
  const content = {rating:'HOLD',financials:{keyMetrics:[{label:'Debt',value:0,source:'[10-K]'}]}};
  assert.throws(() => p.assertPortalProvenance({...content,rating:null}, {}), /rating unresolved/);
  for (const keyMetrics of [undefined, [], [null], [{label:'Debt',value:0}], [{label:'Debt',source:'[10-K]'}]]) {
    assert.throws(() => p.assertPortalProvenance({...content,financials:{keyMetrics}}, {}), /evidence unresolved/);
  }
  assert.throws(() => p.assertPortalProvenance(content, {}), /filing unavailable/);
  assert.doesNotThrow(() => p.assertPortalProvenance(content, {filing_10k_url:'https://www.sec.gov/fixture'}));
});
test('failed and malformed price lookups remain null, including strict demo option', async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [new Response('', {status:503}), Response.json({}), Response.json({chart:{result:[{meta:{regularMarketPrice:'10'}}]}}), Response.json({chart:{result:[{meta:{regularMarketPrice:0}}]}})]) {
      globalThis.fetch = async () => response.clone();
      assert.equal(await prices.fetchPrice('TEST'), null);
      assert.equal(await prices.fetchPriceStrict('TEST', {allowDemoFallback:true}), null);
    }
    globalThis.fetch = async () => Response.json({chart:{result:[{meta:{regularMarketPrice:12,regularMarketTime:1700000000,instrumentType:'EQUITY'}}]}});
    assert.equal((await prices.fetchPrice('TEST')).price,12);
  } finally { globalThis.fetch = original; }
});
