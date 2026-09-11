import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
let mf,db,lib,app;
const company={company_id:'company-test',name:'Synthetic Company',regulator_ids:[{regulator:'synthetic',value:'test-only'}]};
const security=(id,exchange='XNYS',ticker='SYN')=>({security_id:id,company_id:company.company_id,exchange,share_class:'common',currency:'USD',reporting_currency:'USD',adr_ratio:null,aliases:[{ticker,valid_from:'2020-01-01',valid_to:null}]});
async function load(file){const r=await build({entryPoints:[file],bundle:true,write:false,format:'esm',platform:'node'});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
before(async()=>{
 mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-04-10',d1Databases:['DB']});db=await mf.getD1Database('DB');
 for(const file of ['006_research_workspace.sql','010_research_identities.sql']){const sql=readFileSync('src/db/migrations/'+file,'utf8').replace(/--[^\n]*/g,'');for(const s of sql.split(file.startsWith('006')?';':'\n').filter(s=>s.trim()))await db.prepare(s).run();}
 await db.prepare("INSERT INTO research_members(user_id,role) VALUES ('author','analyst')").run();
 await db.prepare("INSERT INTO research_revisions(id,document_id,company_id,ticker,title,source_json,body,created_by,created_at,revised_at,idempotency_key) VALUES ('legacy','doc','company:SYN','SYN','Synthetic','[]','draft','author','2026-01-01','2026-01-01','fixture')").run();
 lib=await load('src/lib/research-identities.ts');const{identities}=await load('src/routes/research-identities.ts');const{Hono}=await import('hono');app=new Hono();app.use('*',async(c,next)=>{c.set('user',c.req.header('x-user')?{id:c.req.header('x-user'),email:'test@example.test'}:null);await next();});app.route('/identities',identities);
});
after(async()=>{await mf?.dispose();});
const req=(path,body,user='author',origin='https://test.local')=>app.fetch(new Request('https://test.local/identities'+path,{method:body===undefined?'GET':'POST',headers:{...(user?{'x-user':user}:{}),origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),{DB:db});
test('registry preserves explicit IDs and legacy unresolved rows, with authenticated registration',async()=>{
 const body={company,security:security('security-us')};assert.equal((await req('/register',body,null)).status,401);assert.equal((await req('/register',body,'outsider')).status,403);assert.equal((await req('/register',body,'author','https://evil.test')).status,403);
 assert.equal((await req('/register',body)).status,201);assert.equal((await req('/register',body)).status,409);
 const resolved=await lib.resolveResearchIdentity(db,{ticker:'syn',asOf:'2026-01-01'});assert.equal(resolved.status,'resolved');assert.equal(resolved.identity.security_id,'security-us');assert.equal(resolved.identity.company_id,'company-test');assert.equal(resolved.identity.verification_status,'analyst_supplied');
 const legacy=await db.prepare("SELECT security_id,identity_status FROM research_revisions WHERE id='legacy'").first();assert.equal(legacy.security_id,null);assert.equal(legacy.identity_status,'unresolved');
});
test('same ticker across markets is ambiguous, same-market overlap rejected atomically',async()=>{
 await lib.registerResearchIdentity(db,{company,security:security('security-london','XLON')},'author');
 assert.equal((await lib.resolveResearchIdentity(db,{ticker:'SYN',asOf:'2026-01-01'})).status,'ambiguous');
 assert.equal((await lib.resolveResearchIdentity(db,{ticker:'SYN',exchange:'XLON',asOf:'2026-01-01'})).identity.security_id,'security-london');
 assert.equal((await lib.resolveResearchIdentity(db,{ticker:'SYN',securityId:'security-us',asOf:'2026-01-01'})).status,'resolved');
 assert.equal((await lib.resolveResearchIdentity(db,{ticker:'WRONG',securityId:'security-us',asOf:'2026-01-01'})).status,'unresolved');
 await assert.rejects(()=>lib.registerResearchIdentity(db,{company,security:security('overlap')},'author'),/overlap/);
 assert.equal(await db.prepare("SELECT security_id FROM research_securities WHERE security_id='overlap'").first(),null);
 const bad=security('bad');bad.currency='ZZZ';await assert.rejects(()=>lib.registerResearchIdentity(db,{company,security:bad},'author'));
});
test('audited rename resolves historical dates and does not overwrite security identity',async()=>{
 const prior=await lib.resolveResearchIdentity(db,{ticker:'SYN',exchange:'XNYS',asOf:'2026-01-01'});
 const change={alias_id:prior.identity.alias_id,valid_to:'2026-01-31',replacement:{ticker:'RENAMED',valid_from:'2026-02-01',valid_to:null},reason:'Synthetic symbol change'};
 assert.equal((await req('/rename',change)).status,201);assert.equal((await req('/rename',change)).status,409);
 assert.equal((await lib.resolveResearchIdentity(db,{ticker:'SYN',exchange:'XNYS',asOf:'2026-01-31'})).identity.security_id,'security-us');
 assert.equal((await lib.resolveResearchIdentity(db,{ticker:'SYN',exchange:'XNYS',asOf:'2026-02-01'})).status,'unresolved');
 assert.equal((await lib.resolveResearchIdentity(db,{ticker:'RENAMED',asOf:'2026-02-01'})).identity.security_id,'security-us');
 const audit=await db.prepare("SELECT before_json,after_json FROM research_identity_events WHERE event_type='alias_rename'").first();assert.equal(JSON.parse(audit.before_json).valid_to,null);assert.equal(JSON.parse(audit.after_json).replacement.ticker,'RENAMED');
 await assert.rejects(()=>db.prepare('DELETE FROM research_identity_events').run(),/Append-only/);
 assert.equal((await req('/resolve?ticker=RENAMED&asOf=2026-02-01')).headers.get('cache-control'),'private, no-store');
 assert.equal((await req('/resolve?ticker=RENAMED')).status,400);
});
