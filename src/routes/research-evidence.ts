import { Hono } from 'hono';
import { checksum, getSource, ingestSource } from '../lib/research-sources';
import { verifyFinancialFact } from '../lib/financial-facts';
import { factSchema, validateResearchPackage } from '../lib/research-package';
type Variables={user:{id:string;email:string}|null;role:string};
/** Mounted beneath workspace's signed-session, membership and same-origin middleware. */
export const evidence = new Hono<{Bindings:{DB:D1Database};Variables:Variables}>();
async function body(request:Request):Promise<any>{
 const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');let size=0;const parts:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1048576){await reader.cancel();throw new Error('Input exceeds 1 MB');}parts.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
evidence.post('/evidence',async c=>{
 try{const b=await body(c.req.raw);if(typeof b.original_text!=='string')return c.json({error:'original_text is required; this endpoint accepts UTF-8 text originals only'},400);
 if(!['text/plain','text/html','text/csv','application/json','application/xml','text/xml'].includes(b.source?.mime_type))return c.json({error:'Binary originals require the private file adapter; text cannot stand in for a PDF or workbook'},400);
 const source=await ingestSource(c.env.DB,b.source,new TextEncoder().encode(b.original_text),c.get('user')!.id);return c.json({source},201);
 }catch{return c.json({error:'Invalid evidence, checksum mismatch, duplicate immutable ID, or source too large'},400);}
});
evidence.get('/evidence/:id',async c=>{const source=await getSource(c.env.DB,c.req.param('id'));return source?c.json({source}):c.json({error:'Evidence not found'},404);});
evidence.post('/packages',async c=>{
 try{
  const p=validateResearchPackage(await body(c.req.raw));
  const row=await c.env.DB.prepare('SELECT id,company_id,version,body,created_by FROM research_revisions WHERE id=?').bind(p.revision_id).first<{id:string;company_id:string;version:number;body:string;created_by:string}>();
  if(!row||row.created_by!==c.get('user')!.id||p.owner!==row.created_by)return c.json({error:'Only the revision author may attach its package'},403);
  if(p.status!=='draft'||p.reviewer!==null||p.visibility==='public')return c.json({error:'Package attachment starts as an internal draft; approval is separate'},400);
  if(p.company_id!==row.company_id||p.workspace_version!==row.version||p.body_checksum!==await checksum(new TextEncoder().encode(row.body)))return c.json({error:'Package identity or revision content changed'},409);
  for(const source of p.sources){const stored=await getSource(c.env.DB,source.source_id);if(JSON.stringify(stored)!==JSON.stringify(source))return c.json({error:'Source must exactly match immutable ledger'},400);}
  // Conditional insertion closes the edit-between-read-and-write race.
  const result=await c.env.DB.prepare('INSERT INTO research_package_snapshots(snapshot_id,package_id,revision_id,workspace_version,body_checksum,package_json,created_by,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM research_revisions WHERE id=? AND version=? AND body=?)').bind(crypto.randomUUID(),p.package_id,p.revision_id,p.workspace_version,p.body_checksum,JSON.stringify(p),p.owner,new Date().toISOString(),p.revision_id,p.workspace_version,row.body).run();
  return c.json({ok:!!result.meta.changes},result.meta.changes?201:409);
 }catch{return c.json({error:'Invalid package contract, immutable snapshot already exists, or missing migration'},400);}
});
evidence.get('/packages/:revision',async c=>{const row=await c.env.DB.prepare('SELECT snapshot_id,package_json FROM research_package_snapshots WHERE revision_id=? ORDER BY workspace_version DESC LIMIT 1').bind(c.req.param('revision')).first<{snapshot_id:string;package_json:string}>();return row?c.json({snapshotId:row.snapshot_id,package:JSON.parse(row.package_json)}):c.json({error:'Package not found'},404);});

evidence.get('/evidence/:id/original',async c=>{
 const row=await c.env.DB.prepare('SELECT o.original FROM research_source_objects o JOIN research_sources s ON s.checksum=o.checksum WHERE s.source_id=?').bind(c.req.param('id')).first<{original:number[]}>();
 if(!row)return c.json({error:'Evidence not found'},404);
 return new Response(new Uint8Array(row.original),{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="source-original.bin"','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
});
evidence.post('/packages/:revision/verify',async c=>{
 try {const b=await body(c.req.raw);const claim=factSchema.parse(b.claim);const row=await c.env.DB.prepare('SELECT snapshot_id,package_json FROM research_package_snapshots WHERE revision_id=? ORDER BY workspace_version DESC LIMIT 1').bind(c.req.param('revision')).first<{snapshot_id:string;package_json:string}>();
 if(!row)return c.json({error:'Evidence package not found'},404);
 const p=validateResearchPackage(JSON.parse(row.package_json)),fact=p.facts.find(f=>f.fact_id===b.evidence_fact_id);if(!fact)return c.json({error:'Evidence fact not found'},404);
 return c.json({...verifyFinancialFact(claim,fact,fact.source_id?await getSource(c.env.DB,fact.source_id):null),evidence_revision:p.revision_id,evidence_workspace_version:p.workspace_version,verification_scope:'Typed comparison to analyst-supplied immutable evidence; original extraction requires review'});
 }catch{return c.json({error:'Invalid financial claim'},400);}
});
