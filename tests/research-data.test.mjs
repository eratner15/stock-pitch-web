import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const fixture=JSON.parse(readFileSync('tests/fixtures/research-package.json','utf8'));
const copy=()=>structuredClone(fixture);
let contract,facts,sources,verifier,mf,db,app;
async function load(file){const r=await build({entryPoints:[file],bundle:true,write:false,format:'esm',platform:'node'});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
before(async()=>{
 [contract,facts,sources,verifier]=await Promise.all(['research-package','financial-facts','research-sources','improve/fact-verify'].map(f=>load('src/lib/'+f+'.ts')));
 mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-04-10',d1Databases:['DB']});db=await mf.getD1Database('DB');
 for(const file of ['006_research_workspace.sql','007_research_evidence.sql']) { const sql=readFileSync('src/db/migrations/'+file,'utf8').replace(/--[^\n]*/g,''); for(const statement of sql.split(file.startsWith('007')?'\n':';').filter(s=>s.trim())) await db.prepare(statement).run(); }
 await db.prepare("INSERT INTO research_members(user_id,role) VALUES ('author','analyst')").run();
 await db.prepare("INSERT INTO research_revisions(id,document_id,company_id,ticker,title,source_json,body,created_by,created_at,revised_at,idempotency_key) VALUES ('revision-fixture','doc','company-fixture','FIXTURE','Synthetic','[]','Synthetic draft','author','2026-01-01','2026-01-01','fixture')").run();
 const {workspace}=await load('src/routes/research-workspace.ts');const {Hono}=await import('hono');app=new Hono();app.use('*',async(c,next)=>{c.set('user',c.req.header('x-user')?{id:c.req.header('x-user'),email:'synthetic@example.test'}:null);await next();});app.route('/workspace',workspace);
});
after(async()=>{await mf?.dispose();});
function request(path,body,user='author'){return app.fetch(new Request('https://test.local/workspace/api'+path,{method:body===undefined?'GET':'POST',headers:{...(user?{'x-user':user}:{}),'origin':'https://test.local','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:db});}
test('package identity, aliases, currency, periods and revision references are validated',()=>{
 assert.equal(contract.validateResearchPackage(copy()).schema_version,'1.0');
 const variants=[p=>p.security_id='missing',p=>p.facts[0].period.start='2026-01-01',p=>p.facts[0].currency='ZZZ',p=>p.facts[0].source_id='missing',p=>p.securities.push({...structuredClone(p.securities[0]),security_id:'other'}),p=>p.artifacts.push({artifact_id:'a',revision_id:'other',kind:'brief',uri:'private:a',checksum:'0'.repeat(64),fact_ids:[],model_ids:[]}),p=>p.facts[0].input_ids=['fact-revenue'],p=>p.judgment.decision_summary.fact_ids=['missing']];
 for(const change of variants){const p=copy();change(p);assert.throws(()=>contract.validateResearchPackage(p));}
 const p=copy();p.securities[0].aliases=[{ticker:'OLD',valid_from:null,valid_to:'2020-12-31'},{ticker:'NEW',valid_from:'2021-01-01',valid_to:null}];assert.doesNotThrow(()=>contract.validateResearchPackage(p));
 p.securities.push({...structuredClone(p.securities[0]),security_id:'foreign',exchange:'XLON'});assert.doesNotThrow(()=>contract.validateResearchPackage(p));
});
test('typed verification rejects coincidental numbers and normalizes scales and signs',()=>{
 const p=copy(),e=p.facts[0],s=p.sources[0];
 assert.equal(facts.verifyFinancialFact({...e,value:1.2,scale:'billion'},e,s).verified,true);
 for(const change of [c=>c.period={...c.period,fiscal_year:2024,end:'2024-12-31',start:'2024-01-01'},c=>c.currency='EUR',c=>c.value=-1200,c=>c.accounting_basis='adjusted',c=>c.segment='North America',c=>c.kind='consensus']){const c=structuredClone(e);change(c);assert.equal(facts.verifyFinancialFact(c,e,s).verified,false);}
 assert.equal(facts.normalizeFact({...e,value:0,raw_value:'0'}).normalized_value,0);
 assert.equal(facts.normalizeFact({...e,value:null,raw_value:null}).normalized_value,null);
 const total={...e,value:3,scale:'billion'};const segments=[{...e,value:1000,segment:'A'},{...e,value:2000,segment:'B'}];assert.equal(facts.checkSegmentTotal(total,segments).passed,true);assert.equal(facts.checkSegmentTotal(total,[...segments,segments[0]]).passed,false);
 const result=verifier.verifyClaims(verifier.extractClaims('Revenue was $1.2B in FY2025','test'),'2024 revenue $1.2B');assert.equal(result.verified,0);assert.equal(verifier.verifyClaims([],'').verification_rate,0);
});
test('immutable evidence preserves duplicate content, timestamps and rights explicitly',async()=>{
 const p=copy(),bytes=new TextEncoder().encode('Synthetic revenue 1200 million USD FY2025 GAAP');
 assert.equal((await request('/evidence',{source:p.sources[0],original_text:new TextDecoder().decode(bytes)},null)).status,401);
 let r=await request('/evidence',{source:p.sources[0],original_text:new TextDecoder().decode(bytes)});assert.equal(r.status,201);
 assert.equal((await sources.getSource(db,'source-synthetic')).published_at,null);
 assert.equal((await sources.ingestSource(db,p.sources[0],bytes,'author')).checksum,p.sources[0].checksum);
 await sources.ingestSource(db,{...p.sources[0],source_id:'restricted',usage_rights:'restricted',quality_status:'unreadable',retrieved_at:null},bytes,'author');
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM research_source_objects').first()).n,1);
 assert.equal(sources.publicSourceProblems(await sources.getSource(db,'restricted')).length,3);
 await assert.rejects(()=>sources.ingestSource(db,{...p.sources[0],document_title:'Changed'},bytes,'author'),/immutable/);
 await assert.rejects(()=>sources.ingestSource(db,p.sources[0],new TextEncoder().encode('Changed'),'author'),/checksum/);
 await assert.rejects(()=>db.prepare('UPDATE research_source_objects SET original=?').bind([1]).run(),/Immutable/);
});
test('workspace package ingestion binds exact author, revision and immutable sources',async()=>{
 const p=copy();assert.equal((await request('/packages',p)).status,201);
 assert.equal((await request('/packages/'+p.revision_id)).status,200);
 const verified=await request('/packages/'+p.revision_id+'/verify',{claim:{...p.facts[0],value:1.2,scale:'billion'},evidence_fact_id:'fact-revenue'});assert.equal((await verified.json()).verified,true);
 const original=await request('/evidence/source-synthetic/original');assert.equal(await original.text(),'Synthetic revenue 1200 million USD FY2025 GAAP');
 assert.equal((await request('/packages',p)).status,400);
 await db.prepare("UPDATE research_revisions SET version=2,body='Edited draft' WHERE id='revision-fixture'").run();
 const edited=copy();edited.workspace_version=2;assert.equal((await request('/packages',edited)).status,409);
 assert.equal((await request('/packages/'+p.revision_id,undefined,null)).status,401);
});

test('rights expiry uses instants across timezone offsets',()=>{
 const p=JSON.parse(readFileSync('tests/fixtures/research-package.json','utf8'));
 const source={...p.sources[0],rights_expiry:'2026-01-01T13:00:00+02:00'};
 assert.ok(sources.publicSourceProblems(source,'2026-01-01T12:00:00Z').includes('Source rights expired'));
});
