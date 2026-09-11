import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
let p;
before(async()=>{const b=await build({entryPoints:['src/lib/research-providers.ts'],bundle:true,write:false,format:'esm',platform:'node'});p=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));});
test('configuration is not an entitlement and missing credentials never fetch',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error()};
 assert.equal((await p.discoverLevyNotes('TEST',{}, {fetcher})).availability,'unconfigured');
 assert.equal((await p.discoverProfile('TEST',{}, {fetcher})).availability,'unconfigured');
 assert.equal(calls,0);assert.equal(p.providerCapabilities({FMP_API_KEY:'secret'})[1].state,'configured_unverified');
 assert.ok(!JSON.stringify(p.providerCapabilities({FMP_API_KEY:'secret'})).includes('secret'));
});
test('read-only fixed origins, no redirects or credential reflection',async()=>{
 for(const symbol of ['https://127.0.0.1/','TEST?apikey=evil','../metadata','TEST\nHost: bad'])assert.throws(()=>p.discoverProfile(symbol,{FMP_API_KEY:'secret'}));
 let observed;
 const r=await p.discoverProfile('TEST',{FMP_API_KEY:'secret'},{fetcher:async(url,init)=>{observed={url,init};return new Response('secret credential failure',{status:403});}});
 assert.equal(r.availability,'unauthorized');assert.equal(observed.init.method,'GET');assert.equal(observed.init.redirect,'error');assert.equal(new URL(observed.url).origin,'https://financialmodelingprep.com');assert.ok(!JSON.stringify(r).includes('secret'));
});
test('Levy discovery returns only internal locators, never mail content',async()=>{
 const r=await p.discoverLevyNotes('TEST',{LEVY_PASSWORD:'fixture'},{now:'2026-09-11T12:00:00Z',maxAgeMs:86400000,fetcher:async(url,init)=>{
 assert.equal(init.headers.Authorization,'Basic '+btoa('research:fixture'));
 return Response.json({notes:[{id:'n1',firm:'Fixture broker',note_type:'earnings',received_at:'2026-09-11T09:00:00Z',email_subject:'SECRET SUBJECT',thesis_summary:'SECRET BODY',web_link:'https://secret.invalid'}]});}});
 assert.equal(r.availability,'available');assert.equal(r.usageRights,'internal');assert.equal(r.freshness,'fresh');assert.ok(!JSON.stringify(r).includes('SECRET'));assert.ok(!JSON.stringify(r).includes('secret.invalid'));assert.equal(r.data.notes[0].locator,'Levy note ID n1');
});
test('foreign issuer forms and freshness remain explicit',async()=>{
 const r=await p.discoverFilings('123',{SEC_USER_AGENT:'Fixture contact'},{fetcher:async()=>Response.json({filings:{recent:{accessionNumber:['0001'],form:['20-F'],filingDate:['2025-01-01'],primaryDocument:['report.htm']}}}),now:'2026-09-11T00:00:00Z',maxAgeMs:86400000});
 assert.equal(r.data.records[0].form,'20-F');assert.equal(r.freshness,'stale');
 assert.equal(p.freshness(null,'2026-01-01'), 'unknown');
 assert.equal(p.freshness('2026-01-02','2026-01-01',10),'unknown');
 assert.equal(p.freshness('2026-09-11T13:00:00+02:00','2026-09-11T12:00:00Z',1800000),'stale');
});
test('provider application errors and missing macro observations do not become zero',async()=>{
 const bad=await p.discoverProfile('TEST',{FMP_API_KEY:'x'},{fetcher:async()=>Response.json({'Error Message':'subscription required'})});assert.equal(bad.availability,'invalid_response');
 const r=await p.discoverMacro('TEST',{FRED_API_KEY:'x'},{fetcher:async()=>Response.json({observations:[{date:'2026-01-01',value:'.'},{date:'2025-01-01',value:'0'}]})});
 assert.equal(r.data.observations[0].value,null);assert.equal(r.data.observations[1].value,0);assert.equal(r.usageRights,'unknown');
});
