import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
let mf,db,app,packageFixture;
before(async()=>{
 mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-04-10',d1Databases:['DB']});db=await mf.getD1Database('DB');
 for(const file of ['006_research_workspace.sql','007_research_evidence.sql','009_research_tracker.sql']){const sql=readFileSync('src/db/migrations/'+file,'utf8').replace(/--[^\n]*/g,'');for(const s of sql.split(file.startsWith('006')?';':'\n').filter(s=>s.trim()))await db.prepare(s).run();}
 await db.prepare("INSERT INTO research_members(user_id,role) VALUES ('author','analyst'),('other','analyst'),('reviewer','reviewer')").run();
 await db.prepare("INSERT INTO research_revisions(id,document_id,company_id,ticker,title,source_json,body,created_by,created_at,revised_at,idempotency_key) VALUES ('revision-fixture','doc','company-fixture','FIXTURE','Synthetic','[]','Synthetic draft','author','2026-01-01','2026-01-01','fixture')").run();
 packageFixture=JSON.parse(readFileSync('tests/fixtures/research-package.json','utf8'));
 packageFixture.judgment.thesis_pillars=[{id:'claim-1',claim:{text:'=1+2',fact_ids:['fact-revenue']},counter_evidence:{text:null,fact_ids:[]},falsifier:'Revenue declines'}];
 packageFixture.judgment.catalysts=[{id:'event-1',description:'Synthetic earnings',date:'2020-01-01',date_kind:'estimated',owner:'author',falsifier:'Revenue declines',source_ids:['source-synthetic']}];
 await savePackage('package-snapshot-1',packageFixture);
 const buildResult=await build({entryPoints:['src/routes/research-tracker.ts'],bundle:true,write:false,format:'esm',platform:'node'});const {tracker}=await import('data:text/javascript;base64,'+Buffer.from(buildResult.outputFiles[0].text).toString('base64'));
 const{Hono}=await import('hono');app=new Hono();app.use('*',async(c,next)=>{c.set('user',c.req.header('x-user')?{id:c.req.header('x-user'),email:'test@example.test'}:null);await next();});app.route('/tracker',tracker);
});
after(async()=>{await mf?.dispose();});
async function savePackage(id,p){await db.prepare('INSERT INTO research_package_snapshots(snapshot_id,package_id,revision_id,workspace_version,body_checksum,package_json,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,p.package_id,p.revision_id,p.workspace_version,p.body_checksum,JSON.stringify(p),'author',new Date().toISOString()).run();}
const req=(path,body,user='author',origin='https://test.local')=>app.fetch(new Request('https://test.local/tracker'+path,{method:body===undefined?'GET':'POST',headers:{...(user?{'x-user':user}:{}),origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:db});
const event=(snapshot,previous,type='observation')=>({snapshot_id:snapshot,previous_event_id:previous,event_type:type,outcome:'Synthetic observation',next_check:'2020-01-01',date_kind:'estimated',owner:'author',source_ids:['source-synthetic'],superseding_snapshot_id:null});
test('package-linked tracker imports idempotently with explicit unknowns and safe CSV',async()=>{
 assert.equal((await req('/import',{package_snapshot_id:'package-snapshot-1'},null)).status,401);
 assert.equal((await req('/import',{package_snapshot_id:'package-snapshot-1'},'other')).status,403);
 assert.equal((await req('/import',{package_snapshot_id:'package-snapshot-1'},'author','https://evil.test')).status,403);
 assert.equal((await req('/import',{package_snapshot_id:'package-snapshot-1'})).status,201);
 assert.equal((await req('/import',{package_snapshot_id:'package-snapshot-1'})).status,201);
 let r=await req('/package/package-fixture');assert.equal(r.headers.get('cache-control'),'private, no-store');const{items}=await r.json();assert.equal(items.length,2);
 const claim=items.find(i=>i.item_kind==='claim'),e=items.find(i=>i.item_kind==='event');assert.equal(claim.state.owner,null);assert.equal(claim.state.next_check,null);assert.equal(e.state.date_kind,'estimated');assert.equal(e.state.overdue,true);
 const csv=await(await req('/package/package-fixture/export.csv')).text();assert.ok(csv.includes("'=1+2"));
});
test('outcomes and corrections append without rewriting old forecasts, with CAS and ownership',async()=>{
 const{items}=await(await req('/package/package-fixture')).json();const e=items.find(i=>i.item_kind==='event');
 assert.equal((await req('/events',event(e.snapshot_id,null),'other')).status,403);
 let r=await req('/events',event(e.snapshot_id,null,'resolved'));assert.equal(r.status,201);const first=(await r.json()).event_id;
 assert.equal((await req('/events',event(e.snapshot_id,null))).status,409);
 let current=(await(await req('/package/package-fixture')).json()).items.find(i=>i.item_kind==='event');assert.equal(current.state.status,'resolved');assert.equal(current.state.overdue,false);
 r=await req('/events',event(e.snapshot_id,first,'data_correction'));assert.equal(r.status,201);const correction=(await r.json()).event_id;
 current=(await(await req('/package/package-fixture')).json()).items.find(i=>i.item_kind==='event');assert.equal(current.state.status,'resolved');assert.equal(current.history.length,2);assert.equal(current.history[1].event_type,'data_correction');
 await assert.rejects(()=>db.prepare('UPDATE research_tracker_snapshots SET item_json=?').bind('{}').run(),/Immutable/);
 await assert.rejects(()=>db.prepare('DELETE FROM research_tracker_events').run(),/Append-only/);
 const p=structuredClone(packageFixture);p.workspace_version=2;p.judgment.catalysts[0].date='2030-01-01';await savePackage('package-snapshot-2',p);
 await req('/import',{package_snapshot_id:'package-snapshot-2'});
 current=(await(await req('/package/package-fixture')).json()).items.find(i=>i.item_kind==='event');assert.equal(current.item.next_check,'2030-01-01');assert.equal(current.state.status,'open');assert.equal(current.history.length,2);assert.equal(current.state.overdue,false);
 r=await req('/events',{...event(e.snapshot_id,correction,'supersession'),superseding_snapshot_id:current.snapshot_id});assert.equal(r.status,201);
 const rows=await db.prepare('SELECT item_json FROM research_tracker_snapshots WHERE tracker_id=? ORDER BY sequence').bind(e.tracker_id).all();assert.equal(JSON.parse(rows.results[0].item_json).next_check,'2020-01-01');
});
