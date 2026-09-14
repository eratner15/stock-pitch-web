// Run with sibling checkouts of the three integration branches and npm ci in each.
// All databases and identities are disposable local fixtures; no external AI calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
async function bundle(path) {
  const result = await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:*'],loader:{'.md':'text'}});
  return result.outputFiles[0].text;
}
const [catalog,workspace,legacy,authCode] = await Promise.all([
  bundle('../lcs-portfolio-intel/src/index.ts'),bundle('src/index.ts'),bundle('../levincap-research/src/index.js'),bundle('src/lib/auth.ts')
]);
const auth = await import('data:text/javascript;base64,'+Buffer.from(authCode).toString('base64'));
const common = {modules:true,compatibilityDate:'2026-04-15',compatibilityFlags:['nodejs_compat']};
const mf = new Miniflare({workers:[
  {...common,name:'catalog',script:catalog,serviceBindings:{WORKSPACE_PUBLICATIONS:'workspace',LEGACY_PUBLICATIONS:'legacy'}},
  {...common,name:'workspace',script:workspace,d1Databases:{DB:'workspace-db'},bindings:{SESSION_SECRET:'local-fixture-secret',RESEARCH_PUBLICATION_ENABLED:'true'},serviceBindings:{RESEARCH_CATALOG:'catalog'}},
  {...common,name:'legacy',script:legacy,d1Databases:{DB:'legacy-db'},bindings:{ADMIN_KEY:'local-fixture-key'}}
]});
try {
  const db = await mf.getD1Database('DB','workspace');
  const oldDb = await mf.getD1Database('DB','legacy');
  async function migrate(db,files) {
    for(const file of files) for(const sql of readFileSync(file,'utf8').replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim())) await db.prepare(sql).run();
  }
  await migrate(db,['005_research_desk.sql','006_research_workspace.sql'].map(f=>'src/db/migrations/'+f));
  await migrate(oldDb,['0001_init.sql','0003_lcv.sql','0008_publication_visibility.sql'].map(f=>'../levincap-research/migrations/'+f));
  await db.prepare("INSERT INTO research_members(user_id,role) VALUES ('author','analyst'),('reviewer','reviewer')").run();
  await oldDb.prepare("INSERT INTO pitches(ticker,company_name,thesis,status,visibility) VALUES ('TEST','SYNTHETIC legacy','fixture public','active','public'),('HIDE','SYNTHETIC hidden','PRIVATE SENTINEL','draft','private')").run();
  const site=await mf.getWorker('catalog'), desk=await mf.getWorker('workspace'), old=await mf.getWorker('legacy');
  const origin='https://research.levincap.com';
  const sessions={};
  for(const user of ['author','reviewer']) sessions[user]=await auth.signSession(user,user+'@example.test','local-fixture-secret');
  async function request(path,body,user='author') {
    return desk.fetch(origin+'/research/workspace'+path,{method:body?'POST':'GET',headers:{cookie:'sp_session='+sessions[user],origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  }
  assert.equal((await desk.fetch(origin+'/research/workspace')).status,401);
  let response=await request('/api/revisions',{ticker:'TEST',title:'SYNTHETIC INTEGRATION publication',sources:['https://example.test/source'],sourceText:'Local fixture evidence',idempotencyKey:'integration-fixture-1'});
  assert.equal(response.status,201); const {id}=await response.json(); assert.ok(id);
  const article=origin+'/research/published/'+id;
  assert.equal((await desk.fetch(article)).status,404);
  for(const [action,body,user] of [
    ['edit',{version:1,body:'SYNTHETIC INTEGRATION BODY'},'author'],
    ['submit',{version:2},'author'],['approve',{version:3},'reviewer'],
    ['publish',{version:4,confirmPublic:true},'reviewer']
  ]) assert.equal((await request('/api/revisions/'+id+'/'+action,body,user)).status,200,action);
  let shared=await (await site.fetch(origin+'/research-catalog')).json();
  assert.deepEqual(shared.unavailable,[]);
  assert.ok(shared.documents.some(d=>d.id==='legacy:TEST'));
  assert.ok(!JSON.stringify(shared).includes('PRIVATE SENTINEL'));
  assert.ok(shared.documents.some(d=>d.canonicalUrl===article));
  const deskCatalog=await (await request('/api/catalog')).json();
  assert.deepEqual(deskCatalog.documents.map(d=>d.id),shared.documents.map(d=>d.id));
  for(const path of ['/','/signal','/all']) {
    const r=await site.fetch(origin+path); assert.equal(r.status,200,path);
    assert.ok((await r.text()).includes('SYNTHETIC INTEGRATION publication'),path);
  }
  assert.equal((await old.fetch(origin+'/all',{redirect:'manual'})).headers.get('location'),origin+'/signal');
  assert.equal((await desk.fetch(article)).status,200);
  assert.equal((await request('/api/revisions/'+id+'/withdraw',{version:5},'reviewer')).status,200);
  shared=await (await site.fetch(origin+'/research-catalog')).json();
  assert.ok(!shared.documents.some(d=>d.canonicalUrl===article));
  assert.ok(!(await (await site.fetch(origin+'/')).text()).includes('SYNTHETIC INTEGRATION publication'));
  assert.equal((await desk.fetch(article)).status,404);
  console.log('PASS: three actual Worker bundles, service bindings, signed fixture sessions, independent review, publication on homepage /all and desk, private exclusion, immediate withdrawal. Local D1 only; live OAuth/AI/ETF and remote staging NOT tested.');
} finally { await mf.dispose(); }
