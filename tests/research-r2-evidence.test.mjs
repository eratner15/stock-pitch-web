import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const sha=b=>createHash('sha256').update(b).digest('hex');
let mf,db,bucket,lib,app;
function pdf(padding=300000){let t='%PDF-1.4\n'+' '.repeat(padding);const off=t.length;t+='1 0 obj\n<< /Type /Catalog >>\nendobj\n';const x=t.length;t+='xref\n0 2\n0000000000 65535 f \n'+String(off).padStart(10,'0')+' 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n'+x+'\n%%EOF\n';return new TextEncoder().encode(t);}
const bytes=pdf();
const source=id=>({...JSON.parse(readFileSync('tests/fixtures/research-package.json','utf8')).sources[0],source_id:id,checksum:sha(bytes),mime_type:'application/pdf',usage_rights:'restricted'});
async function load(file){const r=await build({entryPoints:[file],bundle:true,write:false,format:'esm',platform:'node'});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
before(async()=>{
 mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-04-10',d1Databases:['DB'],r2Buckets:['EVIDENCE_ORIGINALS']});db=await mf.getD1Database('DB');bucket=await mf.getR2Bucket('EVIDENCE_ORIGINALS');
 for(const file of ['006_research_workspace.sql','007_research_evidence.sql','012_research_r2_originals.sql']){const sql=readFileSync('src/db/migrations/'+file,'utf8').replace(/--[^\n]*/g,'');for(const s of sql.split(file.startsWith('006')?';':'\n').filter(s=>s.trim()))await db.prepare(s).run();}
 const{evidence}=await load('src/routes/research-evidence.ts');lib=await load('src/lib/research-sources.ts');const{Hono}=await import('hono');app=new Hono();app.use('*',async(c,next)=>{c.set('user',c.req.header('x-user')?{id:'author',email:'test@example.test'}:null);c.set('role',c.req.header('x-role')||'analyst');await next();});app.route('/api',evidence);
});
after(async()=>{await mf?.dispose();});
function request(path,body,user=true,configured=true,role='analyst'){return app.fetch(new Request('https://test.local/api'+path,{method:body?'POST':'GET',headers:{...(user?{'x-user':'author'}:{}),'x-role':role,origin:'https://test.local'},...(body?{body}:{})}),{DB:db,...(configured?{EVIDENCE_ORIGINALS:bucket}:{})});}
function upload(id,options={}){const f=new FormData();f.set('source',JSON.stringify({...source(id),...options.source}));f.set('file',new Blob([bytes],{type:'application/pdf'}),'synthetic.pdf');return request('/evidence/file',f,options.user??true,options.configured??true);}
test('large restricted originals retain exact bytes in private R2; no public access',async()=>{
 assert.equal((await upload('private-large',{user:false})).status,401);
 assert.equal((await upload('private-large',{configured:false})).status,413);
 const r=await upload('private-large');assert.equal(r.status,201,await r.clone().text());assert.equal((await r.json()).storage,'private_r2');
 const original=await request('/evidence/private-large/original');assert.equal(original.status,200);assert.equal(sha(new Uint8Array(await original.arrayBuffer())),sha(bytes));assert.match(original.headers.get('cache-control'),/private, no-store/);assert.match(original.headers.get('content-disposition'),/^attachment/);
 assert.equal((await request('/evidence/private-large/original',undefined,false)).status,401);assert.equal((await request('/evidence/private-large/original',undefined,true,true,'guest')).status,403);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM research_source_objects').first()).n,0);
 assert.equal((await request('/evidence-capabilities',undefined,true,false)).status,200);
});
test('dedup is content-addressed and tampering cannot replace or be served as original',async()=>{
 assert.equal((await upload('private-large')).status,201);assert.equal((await upload('same-content')).status,201);
 assert.equal((await bucket.list()).objects.length,1);assert.equal((await upload('bad-checksum',{source:{checksum:'0'.repeat(64)}})).status,400);
 assert.equal((await upload('private-large',{source:{document_title:'Changed title'}})).status,400);
 const key='research-originals/sha256/'+sha(bytes);const corrupted=bytes.slice();corrupted[40]=33;await bucket.put(key,corrupted);
 assert.equal((await request('/evidence/private-large/original')).status,503);
 assert.equal((await upload('same-content')).status,503);
 await assert.rejects(()=>db.prepare('UPDATE research_r2_objects SET object_key=?').bind('other').run(),/Immutable/);
});
test('streaming reader aborts at max bound and optional binding fails explicitly',async()=>{
 await assert.rejects(()=>lib.ingestSource(db,source('no-binding'),bytes,'author'),/not configured/);
 await assert.rejects(()=>lib.ingestSource(db,source('oversize'),new Uint8Array(20*1024*1024+1),'author',bucket),/20 MiB/);
 let cancelled=false;const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(65536));},cancel(){cancelled=true;}});
 const r=await app.fetch(new Request('https://test.local/api/evidence/file',{method:'POST',duplex:'half',headers:{'x-user':'author','content-type':'multipart/form-data; boundary=synthetic'},body:stream}),{DB:db,EVIDENCE_ORIGINALS:bucket});assert.equal(r.status,413);assert.equal(cancelled,true);
});
