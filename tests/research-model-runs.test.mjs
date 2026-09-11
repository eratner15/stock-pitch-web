import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const base=JSON.parse(readFileSync('tests/fixtures/research-package.json','utf8'));
const golden=JSON.parse(readFileSync('tests/fixtures/model-kernel-golden.json','utf8'));
let lib,app,db,mf;
async function load(path){const b=await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node'});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));}
function fixture(method='dcf'){
 const pkg=structuredClone(base);pkg.facts=[];pkg.models=[];pkg.assumptions=[];pkg.artifacts=[];pkg.analysis_as_of='2026-12-31T00:00:00Z';
 const instant={start:null,end:'2026-12-31',fiscal_year:2026,kind:'instant',label:'As of valuation'};
 const add=(id,value,unit='currency',period=instant,segment=null)=>{pkg.facts.push({fact_id:id,company_id:pkg.company_id,security_id:pkg.security_id,metric:id,kind:'analyst_assumption',raw_value:String(value),value,unit,scale:unit==='ratio'?'unit':'million',currency:unit==='currency'?'USD':null,period,segment,accounting_basis:'nonfinancial',source_id:null,locator:null,input_ids:[],rationale:'Synthetic assumption'});pkg.assumptions.push({assumption_id:'a-'+id,fact_id:id,rationale:'Synthetic assumption'});};
 const mapping={method,shares:'shares',debt:'debt',cash:'cash',minority_interest:'minority',nonoperating_assets:'assets'};
 add('shares',10,'shares');add('debt',20);add('cash',5);add('minority',0);add('assets',0);
 if(method==='dcf'){mapping.fcf=['fcf1','fcf2'];mapping.wacc='wacc';mapping.terminal_growth='growth';mapping.cash_flow_type='unlevered';add('wacc',.1,'ratio');add('growth',0,'ratio');for(let i=1;i<=2;i++)add('fcf'+i,10,'currency',{start:`${2026+i}-01-01`,end:`${2026+i}-12-31`,fiscal_year:2026+i,kind:'forecast',label:'Forecast year'});}
 else {mapping.segment_values=['segment1','segment2'];add('segment1',40,'currency',instant,'One');add('segment2',60,'currency',instant,'Two');}
 const inputs=pkg.facts.map(f=>f.fact_id),outputs={enterprise_value:'ev',equity_value:'equity',price:'price'};
 for(const [metric,id] of Object.entries(outputs)){add(id,{enterprise_value:100,equity_value:85,price:8.5}[metric]);const f=pkg.facts.at(-1);f.kind='computed';f.metric=metric;f.input_ids=[...inputs];f.scale=metric==='price'?'unit':'million';pkg.assumptions.pop();}
 // Fixture narrative references are irrelevant to arithmetic, but snapshot schema remains valid.
 for(const key of ['decision_summary','what_changed','bear_case','expectations','variant_view'])pkg.judgment[key].fact_ids=[];
 pkg.judgment.thesis_pillars=[];pkg.judgment.catalysts=[];
 pkg.models=[{model_id:'model',revision_id:pkg.revision_id,code_version:golden.kernel_sha256,input_ids:inputs,output_ids:Object.values(outputs),run_at:pkg.analysis_as_of,qa_status:'passed'}];
 return {pkg,request:{snapshot_id:'snapshot',model_id:'model',as_of:pkg.analysis_as_of,sector:'industrial',mapping,outputs}};
}
before(async()=>{
 lib=await load('src/lib/research-model-runs.ts');const {modelRuns}=await load('src/routes/research-model-runs.ts');const {Hono}=await import('hono');
 mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-04-10',d1Databases:['DB']});db=await mf.getD1Database('DB');
 await db.prepare('CREATE TABLE research_revisions (id TEXT PRIMARY KEY)').run();await db.prepare("INSERT INTO research_revisions(id) VALUES ('revision-fixture')").run();
 for(const migration of ['007_research_evidence.sql','011_research_model_receipts.sql'])for(const sql of readFileSync('src/db/migrations/'+migration,'utf8').replace(/--[^\n]*/g,'').split('\n').filter(x=>x.trim()))await db.prepare(sql).run();
 app=new Hono();app.use('*',async(c,next)=>{c.set('user',c.req.header('x-user')?{id:c.req.header('x-user'),email:'fixture@example.test'}:null);c.set('role',c.req.header('x-role')??'analyst');await next();});app.route('/api',modelRuns);
});
after(async()=>{await mf?.dispose();});
test('DCF parity with pinned Python kernel including all 25 sensitivities',()=>{const {pkg,request}=fixture();const r=lib.calculateModelReceipt(pkg,request);for(const key of ['enterprise_value','equity_value','price'])assert.ok(Math.abs(r.values[key]-golden.valuation[key])<1e-9);for(let i=0;i<5;i++)for(let j=0;j<5;j++)assert.ok(Math.abs(r.sensitivity[i][j].price-golden.sensitivity.cells[i][j].price)<1e-9);assert.equal(r.assurance,'deterministic_arithmetic_only');});
test('SOTP bridge produces 100 EV,85 equity,8.5 price',()=>{const {pkg,request}=fixture('sotp');assert.deepEqual(lib.calculateModelReceipt(pkg,request).values,{enterprise_value:100,equity_value:85,price:8.5});});
test('broken dimensions, dates, assumptions, pairing, outputs and dependencies fail',()=>{
 const changes=[p=>p.facts[0].value=0,p=>p.facts[0].scale='unit',p=>p.facts[1].currency='EUR',p=>p.facts[1].security_id='other',p=>p.assumptions=[],p=>p.facts.find(f=>f.fact_id==='wacc').value=0,p=>p.facts.find(f=>f.fact_id==='growth').value=.1,p=>p.facts.find(f=>f.fact_id==='fcf2').value=-1,p=>p.facts.find(f=>f.fact_id==='fcf1').period.start='2026-01-01',p=>p.facts.find(f=>f.fact_id==='price').value=9,p=>p.facts.find(f=>f.fact_id==='price').input_ids=['shares'],p=>p.models[0].input_ids.pop(),p=>p.models[0].run_at='2027-01-01T00:00:00Z'];
 for(const change of changes){const {pkg,request}=fixture();change(pkg);assert.throws(()=>lib.calculateModelReceipt(pkg,request));}
});
async function snapshot(pkg,id='snapshot'){await db.prepare('INSERT INTO research_package_snapshots VALUES (?,?,?,?,?,?,?,?)').bind(id,pkg.package_id,pkg.revision_id,pkg.workspace_version,pkg.body_checksum,JSON.stringify(pkg),pkg.owner,pkg.created_at).run();}
function post(request,user='author',origin='https://test.local',role='analyst'){return app.fetch(new Request('https://test.local/api/model-runs',{method:'POST',headers:{'content-type':'application/json',origin,...(user?{'x-user':user}:{}),'x-role':role},body:typeof request==='string'?request:JSON.stringify(request)}),{DB:db});}
test('client QA flag grants no receipt; authenticated server receipt is immutable and snapshot bound',async()=>{
 const {pkg,request}=fixture();await snapshot(pkg);
 assert.equal((await lib.modelReceiptsForReview(db,'snapshot',pkg)).length,1);
 assert.equal((await post(request,null)).status,401);assert.equal((await post(request,'author','https://evil.test')).status,403);assert.equal((await post(request,'author','https://test.local','viewer')).status,403);assert.equal((await post(request,'stranger')).status,400);
 assert.equal((await post({...request,as_of:'2025-01-01T00:00:00Z'})).status,400);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM research_model_receipts').first()).n,0);
 const response=await post(request);assert.equal(response.status,201,await response.clone().text());assert.match(response.headers.get('cache-control'),/no-store/);
 assert.deepEqual(await lib.modelReceiptsForReview(db,'snapshot',pkg),[]);assert.equal((await post(request)).status,201);
 const altered=structuredClone(pkg);altered.facts[0].value=11;assert.equal((await lib.modelReceiptsForReview(db,'snapshot',altered)).length,1);assert.equal((await lib.modelReceiptsForReview(db,'different',pkg)).length,1);
 await assert.rejects(()=>db.prepare("UPDATE research_model_receipts SET engine_version='forged'").run(),/Immutable/);await assert.rejects(()=>db.prepare('DELETE FROM research_model_receipts').run(),/Immutable/);
 assert.equal((await post(' '.repeat(32769))).status,413);
});
