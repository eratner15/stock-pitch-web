/** Local synthetic integration proof. No production bindings or provider calls. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {Hono} from 'hono';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=s=>createHash('sha256').update(s).digest('hex');
const originalText='Synthetic revenue 1200 million USD FY2025 GAAP';
function statements(sql){const triggers=[];const cleaned=sql.replace(/--[^\n]*/g,'').replace(/CREATE TRIGGER[\s\S]*?\bEND\s*;/gi,t=>{triggers.push(t);return '';});return [...cleaned.split(';').filter(s=>s.trim()),...triggers];}
export async function runSyntheticApprovedWorkflow({fixtures,output,exerciseRevocation=false}){
 const inputPath=join(fixtures,'synthetic-model-package.json'),requestPath=join(fixtures,'synthetic-model-request.json');
 const original=JSON.parse(readFileSync(inputPath,'utf8')),p=structuredClone(original),modelRequest=JSON.parse(readFileSync(requestPath,'utf8'));
 assert.equal(original.sources.length,1,'This proof needs an explicit original-byte fixture for every source');assert.equal(hash(originalText),original.sources[0].checksum,'Fixture source checksum changed: supply the actual matching fixture bytes, do not rewrite source metadata');
 const sourceIdentity=original.securities.find(s=>s.security_id===original.security_id),company=original.companies.find(c=>c.company_id===original.company_id);
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("local fixture")}}',compatibilityDate:'2026-04-10',d1Databases:['DB']});
 const checks=[],transitions=[];
 try{
  const db=await mf.getD1Database('DB');
  const migrations=readdirSync(join(repo,'src/db/migrations')).filter(f=>/^0(0[5-9]|1[0-2])_.*\.sql$/.test(f)).sort();assert.equal(migrations.length,8);
  for(const file of migrations)for(const sql of statements(readFileSync(join(repo,'src/db/migrations',file),'utf8')))await db.prepare(sql).run();
  await db.prepare("INSERT INTO research_members(user_id,role) VALUES ('author','analyst'),('independent-reviewer','reviewer')").run();
  const b=await build({entryPoints:[join(repo,'src/routes/research-workspace.ts')],bundle:true,write:false,format:'esm',platform:'node'});
  const{workspace}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
  const app=new Hono();app.use('*',async(c,next)=>{const actor=c.req.header('x-synthetic-actor');c.set('user',actor?{id:actor,email:actor+'@example.test'}:null);await next();});app.route('/workspace',workspace);
  const env={DB:db,RESEARCH_PUBLICATION_ENABLED:'false',WorkflowAgent:{get(){throw new Error('Live generation is forbidden in this fixture');}}};
  async function call(path,value,actor='author',expected=200){const r=await app.fetch(new Request('https://local.synthetic/workspace/api'+path,{method:value===undefined?'GET':'POST',headers:{...(actor?{'x-synthetic-actor':actor}:{}),origin:'https://local.synthetic','content-type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})}),env);const data=await r.json();assert.equal(r.status,expected,path+': '+JSON.stringify(data));checks.push({path,actor,status:r.status});return data;}
  await call('/evidence',{source:p.sources[0],original_text:originalText},undefined,201);
  await call('/identities/register',{company,security:sourceIdentity},undefined,201);
  const ticker=sourceIdentity.aliases[0].ticker;
  const draft=await call('/revisions',{ticker,title:'Synthetic model workflow integration proof',sourceText:originalText,sources:['https://example.com/synthetic-fixture-only'],idempotencyKey:'synthetic-approved-workflow',securityId:p.security_id,exchange:sourceIdentity.exchange,asOf:p.analysis_as_of.slice(0,10)},undefined,201);
  const revisionId=draft.id;assert.equal(draft.identityStatus,'analyst_supplied');
  const body=['SYNTHETIC INFRASTRUCTURE TEST ONLY',...['decision_summary','what_changed','bear_case','expectations','variant_view'].map(k=>k+': '+(p.judgment[k].text??'Unresolved'))].join('\n\n');
  await call('/revisions/'+revisionId+'/edit',{version:1,body});
  const saved=(await call('/revisions/'+revisionId)).revision;
  p.revision_id=revisionId;p.parent_revision_id=null;p.owner='author';p.reviewer=null;p.status='draft';p.workspace_version=saved.version;p.body_checksum=hash(body);
  for(const model of p.models)model.revision_id=revisionId;for(const artifact of p.artifacts)artifact.revision_id=revisionId;
  assert.deepEqual(p.facts,original.facts);assert.deepEqual(p.assumptions,original.assumptions);assert.deepEqual(p.judgment,original.judgment);
  await call('/packages',p,undefined,201);const attached=await call('/packages/'+revisionId);const snapshotId=attached.snapshotId;
  await call('/delivery/'+revisionId,undefined,undefined,409);
  await call('/revisions/'+revisionId+'/submit',{version:saved.version,packageSnapshotId:snapshotId},undefined,409);
  const receipt=await call('/model-runs',{...modelRequest,snapshot_id:snapshotId},undefined,201);assert.equal(receipt.model_id,modelRequest.model_id);
  await call('/revisions/'+revisionId+'/submit',{version:saved.version,packageSnapshotId:snapshotId});transitions.push('submitted');
  await call('/revisions/'+revisionId+'/approve',{version:saved.version+1,packageSnapshotId:snapshotId},'author',403);
  await call('/revisions/'+revisionId+'/approve',{version:saved.version+1,packageSnapshotId:snapshotId},'independent-reviewer');transitions.push('independently_approved');
  await call('/delivery/'+revisionId,undefined,null,401);
  const envelope=await call('/delivery/'+revisionId);assert.equal(envelope.reviewed_by,'independent-reviewer');assert.notEqual(envelope.reviewed_by,p.owner);assert.equal(hash(envelope.package_json),envelope.package_checksum);
  const exported=JSON.parse(envelope.package_json);assert.equal(exported.revision_id,revisionId);assert.deepEqual(exported.facts,original.facts);assert.equal(exported.models[0].model_id,original.models[0].model_id);
  const imported=await call('/tracker/import',{package_snapshot_id:snapshotId},undefined,201);const tracker=await call('/tracker/package/'+p.package_id);assert.equal(imported.snapshot_ids.length,p.judgment.thesis_pillars.length+p.judgment.catalysts.length);assert.ok(tracker.items.every(i=>i.revision_id===revisionId));
  let revocation=false;if(exerciseRevocation){const row=(await call('/revisions/'+revisionId)).revision;await call('/revisions/'+revisionId+'/edit',{version:row.version,body:body+'\nSynthetic subsequent edit'});await call('/delivery/'+revisionId,undefined,undefined,409);revocation=true;}
  const context={schema_version:1,purpose:'synthetic_local_integration_only',inputs:{package_file:resolve(inputPath),package_sha256:hash(readFileSync(inputPath)),model_request_file:resolve(requestPath),model_request_sha256:hash(readFileSync(requestPath))},mapping:{original_revision_id:original.revision_id,revision_id:revisionId,snapshot_id:snapshotId,package_id:p.package_id,author:p.owner,reviewer:envelope.reviewed_by,attached_workspace_version:p.workspace_version,approved_revision_version:envelope.revision_version,body_checksum:p.body_checksum},unchanged:{facts:true,assumptions:true,judgment:true,model_id:true,company_security_ids:true},migrations,transitions,checks,post_export_edit_revocation_verified:revocation,authentication_scope:'Actual workspace membership/role middleware and routes; synthetic user context injected upstream. Signed-session verification is covered by separate real-Worker auth tests.',external_provider_calls:0,production_writes:false,limitation:'This is a local synthetic reviewer identity, not a real analyst approval or evidence certification.'};
  if(output){mkdirSync(output,{recursive:true});writeFileSync(join(output,'approved-export.json'),JSON.stringify(envelope,null,2)+'\n');writeFileSync(join(output,'package.json'),envelope.package_json);writeFileSync(join(output,'model-receipt.json'),JSON.stringify(receipt,null,2)+'\n');writeFileSync(join(output,'tracker-history.json'),JSON.stringify(tracker,null,2)+'\n');writeFileSync(join(output,'workflow-context.json'),JSON.stringify(context,null,2)+'\n');}
  return {context,envelope,receipt,tracker};
 }finally{await mf.dispose();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argv=process.argv.slice(2);const arg=n=>argv[argv.indexOf(n)+1];if(!argv.includes('--fixtures')||!argv.includes('--output'))throw new Error('Usage: node scripts/synthetic-approved-workflow.mjs --fixtures /absolute/fixtures --output /absolute/output');
 const result=await runSyntheticApprovedWorkflow({fixtures:resolve(arg('--fixtures')),output:resolve(arg('--output'))});console.log(JSON.stringify({ok:true,revision_id:result.envelope.revision_id,package_checksum:result.envelope.package_checksum,model_id:result.receipt.model_id,steps:result.context.checks.length}));
}
