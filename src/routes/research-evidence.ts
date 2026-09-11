import { Hono } from 'hono';
import { checksum, getSource, ingestSource, inspectBinaryOriginal, ingestWorkbookExtraction, MAX_ORIGINAL_BYTES, MAX_R2_ORIGINAL_BYTES, readOriginal, EvidenceInputError } from '../lib/research-sources';
import { verifyFinancialFact } from '../lib/financial-facts';
import { factSchema, validateResearchPackage } from '../lib/research-package';
type Variables={user:{id:string;email:string}|null;role:string};
/** Mounted beneath workspace's signed-session, membership and same-origin middleware. */
export const evidence = new Hono<{Bindings:{DB:D1Database;EVIDENCE_ORIGINALS?:R2Bucket};Variables:Variables}>();
evidence.use('*',async(c,next)=>{
 c.header('cache-control','private, no-store');c.header('x-content-type-options','nosniff');
 if(!c.get('user'))return c.json({error:'Research sign-in required'},401);
 if(!['analyst','reviewer','admin'].includes(c.get('role')))return c.json({error:'Research team membership required'},403);
 await next();
});
async function boundedBytes(request:Request,max:number):Promise<Uint8Array>{
 const declared=Number(request.headers.get('content-length'));if(Number.isFinite(declared)&&declared>max)throw new EvidenceInputError('Input exceeds the supported byte limit',413);
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');let size=0;const parts:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new EvidenceInputError('Input exceeds the supported byte limit',413);}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes;
}
async function body(request:Request):Promise<any>{return JSON.parse(new TextDecoder().decode(await boundedBytes(request,1048576)));}
evidence.get('/evidence-capabilities',c=>c.json({small_original_storage:'private_d1',large_original_storage:c.env.EVIDENCE_ORIGINALS?'private_r2_binding_present':'not_configured',maximum_original_bytes:c.env.EVIDENCE_ORIGINALS?MAX_R2_ORIGINAL_BYTES:MAX_ORIGINAL_BYTES,large_storage_requires_migration:'012_research_r2_originals.sql',public_original_urls:false}));
evidence.post('/evidence/file',async c=>{
 try{
  const contentType=c.req.header('content-type')??'';
  if(!/^multipart\/form-data\s*;/i.test(contentType))return c.json({error:'Use multipart/form-data with source metadata and a file'},415);
  const maximum=c.env.EVIDENCE_ORIGINALS?MAX_R2_ORIGINAL_BYTES:MAX_ORIGINAL_BYTES;
  const bytes=await boundedBytes(c.req.raw,maximum+40960);
  const form=await new Response(bytes as BodyInit,{headers:{'content-type':contentType}}).formData();
  let unknownPart=false;form.forEach((_value,key)=>{if(!['file','source'].includes(key))unknownPart=true;});
  if(form.getAll('file').length!==1||form.getAll('source').length!==1||unknownPart)return c.json({error:'Exactly one file and one source metadata part are required'},400);
  const file=form.get('file'),metadata=form.get('source');
  if(!(file instanceof File)||typeof metadata!=='string'||new TextEncoder().encode(metadata).length>32768)return c.json({error:'Invalid file or oversized source metadata'},400);
  const input=JSON.parse(metadata);
  if(file.type!==input?.mime_type)return c.json({error:'File MIME and source metadata MIME must match'},415);
  const original=new Uint8Array(await file.arrayBuffer());
  const inspection=inspectBinaryOriginal(original,file.type,maximum);
  const source=await ingestSource(c.env.DB,input,original,c.get('user')!.id,c.env.EVIDENCE_ORIGINALS);
  return c.json({source,original_bytes:original.length,storage:original.length>MAX_ORIGINAL_BYTES?'private_r2':'private_d1',...inspection},201);
 }catch(error){return error instanceof EvidenceInputError?c.json({error:error.message},error.status):c.json({error:'Invalid binary source metadata, checksum, container, or immutable source ID'},400);}
});
evidence.post('/evidence',async c=>{
 try{const b=await body(c.req.raw);if(typeof b.original_text!=='string')return c.json({error:'original_text is required; this endpoint accepts UTF-8 text originals only'},400);
 if(!['text/plain','text/html','text/csv','application/json','application/xml','text/xml'].includes(b.source?.mime_type))return c.json({error:'Binary originals require the private file adapter; text cannot stand in for a PDF or workbook'},400);
 const source=await ingestSource(c.env.DB,b.source,new TextEncoder().encode(b.original_text),c.get('user')!.id,c.env.EVIDENCE_ORIGINALS);return c.json({source},201);
 }catch{return c.json({error:'Invalid evidence, checksum mismatch, duplicate immutable ID, or source too large'},400);}
});
evidence.get('/evidence/:id',async c=>{const source=await getSource(c.env.DB,c.req.param('id'));return source?c.json({source}):c.json({error:'Evidence not found'},404);});
evidence.post('/evidence/:id/workbook-cells',async c=>{
 try{
  const original=await getSource(c.env.DB,c.req.param('id'));if(!original)return c.json({error:'Original workbook not found'},404);
  const result=await ingestWorkbookExtraction(c.env.DB,original,await body(c.req.raw),c.get('user')!.id,c.env.EVIDENCE_ORIGINALS);
  return c.json(result,201);
 }catch(error){return error instanceof EvidenceInputError?c.json({error:error.message},error.status):c.json({error:'Invalid workbook extraction contract or immutable source ID'},400);}
});
evidence.post('/packages',async c=>{
 try{
  const p=validateResearchPackage(await body(c.req.raw));
  const row=await c.env.DB.prepare('SELECT id,company_id,security_id,identity_status,version,body,created_by FROM research_revisions WHERE id=?').bind(p.revision_id).first<{id:string;company_id:string;security_id:string|null;identity_status:string;version:number;body:string;created_by:string}>();
  if(!row||row.created_by!==c.get('user')!.id||p.owner!==row.created_by)return c.json({error:'Only the revision author may attach its package'},403);
  if(row.identity_status!=='analyst_supplied'||!row.security_id||p.security_id!==row.security_id)return c.json({error:'Resolve the revision security identity before attaching its package'},409);
  if(p.status!=='draft'||p.reviewer!==null||p.visibility==='public')return c.json({error:'Package attachment starts as an internal draft; approval is separate'},400);
  if(p.company_id!==row.company_id||p.workspace_version!==row.version||p.body_checksum!==await checksum(new TextEncoder().encode(row.body)))return c.json({error:'Package identity or revision content changed'},409);
  for(const source of p.sources){const stored=await getSource(c.env.DB,source.source_id);if(JSON.stringify(stored)!==JSON.stringify(source))return c.json({error:'Source must exactly match immutable ledger'},400);}
  // Conditional insertion closes the edit-between-read-and-write race.
  const result=await c.env.DB.prepare(`INSERT INTO research_package_snapshots(snapshot_id,package_id,revision_id,workspace_version,body_checksum,package_json,created_by,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM research_revisions WHERE id=? AND version=? AND body=? AND company_id=? AND security_id=? AND identity_status='analyst_supplied')`).bind(crypto.randomUUID(),p.package_id,p.revision_id,p.workspace_version,p.body_checksum,JSON.stringify(p),p.owner,new Date().toISOString(),p.revision_id,p.workspace_version,row.body,p.company_id,p.security_id).run();
  return c.json({ok:!!result.meta.changes},result.meta.changes?201:409);
 }catch{return c.json({error:'Invalid package contract, immutable snapshot already exists, or missing migration'},400);}
});
evidence.get('/packages/:revision',async c=>{const row=await c.env.DB.prepare('SELECT snapshot_id,package_json FROM research_package_snapshots WHERE revision_id=? ORDER BY workspace_version DESC LIMIT 1').bind(c.req.param('revision')).first<{snapshot_id:string;package_json:string}>();return row?c.json({snapshotId:row.snapshot_id,package:JSON.parse(row.package_json)}):c.json({error:'Package not found'},404);});

evidence.get('/evidence/:id/original',async c=>{
 try{const original=await readOriginal(c.env.DB,c.req.param('id'),c.env.EVIDENCE_ORIGINALS);
 if(!original)return c.json({error:'Evidence not found'},404);
 return new Response(original as BodyInit,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="source-original.bin"','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
 }catch(error){return error instanceof EvidenceInputError?c.json({error:error.message},error.status):c.json({error:'Original retrieval failed'},503);}
});
evidence.post('/packages/:revision/verify',async c=>{
 try {const b=await body(c.req.raw);const claim=factSchema.parse(b.claim);const row=await c.env.DB.prepare('SELECT snapshot_id,package_json FROM research_package_snapshots WHERE revision_id=? ORDER BY workspace_version DESC LIMIT 1').bind(c.req.param('revision')).first<{snapshot_id:string;package_json:string}>();
 if(!row)return c.json({error:'Evidence package not found'},404);
 const p=validateResearchPackage(JSON.parse(row.package_json)),fact=p.facts.find(f=>f.fact_id===b.evidence_fact_id);if(!fact)return c.json({error:'Evidence fact not found'},404);
 return c.json({...verifyFinancialFact(claim,fact,fact.source_id?await getSource(c.env.DB,fact.source_id):null),evidence_revision:p.revision_id,evidence_workspace_version:p.workspace_version,verification_scope:'Typed comparison to analyst-supplied immutable evidence; original extraction requires review'});
 }catch{return c.json({error:'Invalid financial claim'},400);}
});
