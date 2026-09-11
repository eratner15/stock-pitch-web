import { sourceSchema, type ResearchSource } from './research-package';
export async function checksum(bytes:Uint8Array):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('');}
/** D1 stores bounded originals; larger files need a configured private object store. */
export async function ingestSource(db:D1Database,input:unknown,bytes:Uint8Array,actor:string):Promise<ResearchSource>{
  if(!bytes.length||bytes.length>262144)throw new Error('Original must be 1–262144 bytes; larger sources require private object storage');
  const parsed=sourceSchema.parse(input);
  const hash=await checksum(bytes);
  if(parsed.checksum!==hash)throw new Error('Source checksum does not match original');
  const stamp=new Date().toISOString();
  const existing=await db.prepare('SELECT metadata_json FROM research_sources WHERE source_id=?').bind(parsed.source_id).first<{metadata_json:string}>();
  if(existing){if(existing.metadata_json!==JSON.stringify(parsed))throw new Error('Source ID is immutable');return parsed;}
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO research_source_objects(checksum,original,byte_length,created_at) VALUES (?,?,?,?)').bind(hash,Array.from(bytes),bytes.length,stamp),
    db.prepare('INSERT INTO research_sources(source_id,checksum,metadata_json,created_by,created_at) VALUES (?,?,?,?,?)').bind(parsed.source_id,hash,JSON.stringify(parsed),actor,stamp)
  ]);
  return parsed;
}
export async function getSource(db:D1Database,id:string):Promise<ResearchSource|null>{const row=await db.prepare('SELECT metadata_json FROM research_sources WHERE source_id=?').bind(id).first<{metadata_json:string}>();return row?sourceSchema.parse(JSON.parse(row.metadata_json)):null;}
export function publicSourceProblems(source:ResearchSource,at=new Date().toISOString()):string[]{const problems:string[]=[];if(source.usage_rights!=='public')problems.push('Source rights are not public');if(source.rights_expiry&&Date.parse(source.rights_expiry)<=Date.parse(at))problems.push('Source rights expired');if(source.quality_status!=='verified_source')problems.push('Source quality unresolved');if(!source.retrieved_at)problems.push('Retrieval timestamp missing');return problems;}
