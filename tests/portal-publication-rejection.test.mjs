import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
test('actual generation route rejects provenance failure without publishing pages or catalog row', async () => {
  const output = await build({entryPoints:['src/index.ts'],bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:*'],loader:{'.md':'text'},plugins:[{
    name:'synthetic-provider-fixtures',setup(b) {
      b.onLoad({filter:/\/portal-generator\.ts$/}, () => ({contents:`export const collectResearch=async()=>({ticker:'TEST',filing_10k_url:'https://www.sec.gov/fixture'}); export const writePortalContent=async()=>({rating:'Unrated',financials:{keyMetrics:[]}});`,loader:'ts'}));
      b.onLoad({filter:/\/prices\.ts$/}, async args => ({contents:readFileSync(args.path,'utf8').replace('async function fetchFromYahoo(ticker: string): Promise<PriceQuote | null> {', 'async function fetchFromYahoo(ticker: string): Promise<PriceQuote | null> { return {ticker,price:10,change_1d:null,company:"Synthetic",as_of:"2026-01-01"};'),loader:'ts'}));
    }
  }]});
  const mf = new Miniflare({modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-04-10',compatibilityFlags:['nodejs_compat'],bindings:{ADMIN_KEY:'synthetic'},d1Databases:['DB'],kvNamespaces:['REQUESTS']});
  try {
    const db = await mf.getD1Database('DB');
    for (const file of ['003_portal_jobs.sql','004_portals_and_feedback.sql']) {
      for (const s of readFileSync('src/db/migrations/'+file,'utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim())) await db.prepare(s).run();
    }
    const kv = await mf.getKVNamespace('REQUESTS');
    await kv.put('portal:TEST:content',JSON.stringify({rating:'BUY',priceTargetNum:15}));
    await kv.put('portal:TEST:memo','Existing published snapshot');
    const response=await mf.dispatchFetch('https://research.levincap.com/stock-pitch/generate',{method:'POST',headers:{'content-type':'application/json','x-admin-key':'synthetic'},body:JSON.stringify({ticker:'TEST'})});
    assert.equal(response.status,500);
    assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM portals').first()).n,0);
    assert.equal((await db.prepare('SELECT status FROM portal_jobs').first()).status,'failed');
    assert.equal(await kv.get('portal:TEST:memo'),'Existing published snapshot');
    assert.equal(await kv.get('portal:TEST:index'),null);
  } finally { await mf.dispose(); }
});
