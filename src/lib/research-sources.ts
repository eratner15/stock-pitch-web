import { sourceSchema, type ResearchSource } from './research-package';
import { z } from 'zod';
export const MAX_ORIGINAL_BYTES = 262144;
export const PDF_MIME = 'application/pdf';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export class EvidenceInputError extends Error {
  constructor(message:string, public status:400|413|415 = 400) { super(message); this.name = 'EvidenceInputError'; }
}

/** Container recognition only: no PDF execution, ZIP extraction or formula evaluation. */
export function inspectBinaryOriginal(bytes:Uint8Array,mime:string):{format:'pdf'|'xlsx';check:'signature_and_container';extraction:'not_performed'} {
  if (!bytes.length || bytes.length > MAX_ORIGINAL_BYTES) throw new EvidenceInputError('Original must be 1–262144 bytes; larger sources require configured private object storage',413);
  if (mime === PDF_MIME) {
    const prefix = new TextDecoder('ascii').decode(bytes.slice(0, 12));
    const tail = new TextDecoder('ascii').decode(bytes.slice(-1024));
    if (!/^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n|\s)/.test(prefix) || !/%%EOF\s*$/.test(tail)) throw new EvidenceInputError('File does not have a supported PDF header and end marker',415);
    const pointer=/startxref\s+(\d+)\s+%%EOF\s*$/.exec(tail);
    const offset=pointer?Number(pointer[1]):-1;
    const xref=offset>=0&&offset<bytes.length?new TextDecoder('ascii').decode(bytes.slice(offset,offset+512)):'';
    if (!/^xref\s/.test(xref)&&!(/^\d+\s+\d+\s+obj\b/.test(xref)&&/\/Type\s*\/XRef\b/.test(xref))) throw new EvidenceInputError('PDF cross-reference pointer is missing or invalid',415);
    return {format:'pdf',check:'signature_and_container',extraction:'not_performed'};
  }
  if (mime !== XLSX_MIME) throw new EvidenceInputError('Only PDF and XLSX binary originals are supported',415);
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16 = (at:number) => view.getUint16(at,true), u32 = (at:number) => view.getUint32(at,true);
  if (bytes.length < 22 || u32(0) !== 0x04034b50) throw new EvidenceInputError('XLSX must be an OOXML ZIP container',415);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
    if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === bytes.length) { end = at; break; }
  }
  if (end < 0) throw new EvidenceInputError('XLSX ZIP directory is missing or truncated',415);
  const count = u16(end+10), directorySize = u32(end+12), directoryOffset = u32(end+16);
  if (u16(end+4) || u16(end+6) || u16(end+8)!==count || !count || count>2048 || directoryOffset+directorySize!==end) throw new EvidenceInputError('Multipart, ZIP64 or oversized ZIP directories are unsupported',415);
  const names = new Set<string>(); let cursor=directoryOffset, expanded=0;
  for (let index=0; index<count; index++) {
    if (cursor+46>end || u32(cursor)!==0x02014b50) throw new EvidenceInputError('Malformed XLSX ZIP directory',415);
    const flags=u16(cursor+8), method=u16(cursor+10), compressed=u32(cursor+20), uncompressed=u32(cursor+24);
    const nameLength=u16(cursor+28), extra=u16(cursor+30), comment=u16(cursor+32), local=u32(cursor+42);
    if (cursor+46+nameLength+extra+comment>end || (flags&1) || ![0,8].includes(method) || local+30>directoryOffset || u32(local)!==0x04034b50) throw new EvidenceInputError('Unsupported encrypted or malformed XLSX entry',415);
    const name = new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(cursor+46,cursor+46+nameLength));
    if (!name || names.has(name) || name.startsWith('/') || name.includes('\\') || name.includes('\0') || name.split('/').includes('..')) throw new EvidenceInputError('Unsafe or duplicate XLSX entry name',415);
    const localNameLength=u16(local+26), localExtra=u16(local+28);
    if (local+30+localNameLength+localExtra+compressed>directoryOffset || u16(local+8)!==method || u16(local+6)!==flags || new TextDecoder().decode(bytes.slice(local+30,local+30+localNameLength))!==name) throw new EvidenceInputError('XLSX entry does not match its local header',415);
    names.add(name); expanded+=uncompressed;
    if (expanded>32*1024*1024 || /vbaProject\.bin$/i.test(name)) throw new EvidenceInputError('Macro-enabled or excessively expanded workbooks are unsupported',415);
    cursor += 46+nameLength+extra+comment;
  }
  if (cursor!==end || !['[Content_Types].xml','_rels/.rels','xl/workbook.xml'].every(name=>names.has(name))) throw new EvidenceInputError('ZIP container lacks required XLSX workbook parts',415);
  return {format:'xlsx',check:'signature_and_container',extraction:'not_performed'};
}

const cellValue = z.union([z.string().max(32767),z.number().finite(),z.boolean(),z.null()]);
const cellSchema = z.object({id:z.string().max(200),sheet:z.string().min(1).max(31),cell:z.string().regex(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/),sheet_state:z.enum(['visible','hidden','veryHidden']),raw_value:cellValue,formula:z.string().max(32767).startsWith('=').nullable(),cached_value:cellValue,number_format:z.string().max(1000),provenance_comment:z.string().max(32767).nullable(),metric:z.null(),currency:z.null(),scale:z.null(),period:z.null(),basis:z.null()}).strict();
export const workbookExtractionSchema = z.object({schema_version:z.literal(1),source_id:z.string().regex(/^sha256:[a-f0-9]{64}$/),filename:z.string().min(1).max(255),usage_rights:z.literal('unknown'),visibility:z.literal('restricted_client'),recalculation:z.literal('not_performed'),has_macros:z.boolean(),external_links:z.number().int().min(0),cells:z.array(cellSchema).max(5000),issues:z.array(z.object({code:z.enum(['MACROS_PRESENT','EXTERNAL_LINKS','STORED_ERROR','MISSING_FORMULA_CACHE','EXTERNAL_FORMULA_REFERENCE']),cell_id:z.string().max(200).optional()}).strict()).max(10000),financial_mapping_status:z.literal('requires_analyst_mapping'),clean_validation:z.literal(false)}).strict();

/** Preserve an asserted extraction separately; do not promote caches into facts. */
export async function ingestWorkbookExtraction(db:D1Database,original:ResearchSource,input:unknown,actor:string) {
  const stored=await getSource(db,original.source_id);
  if (!stored || JSON.stringify(stored)!==JSON.stringify(original)) throw new EvidenceInputError('Workbook original must match the immutable source ledger');
  if (original.mime_type!==XLSX_MIME) throw new EvidenceInputError('Workbook cell extraction requires a stored XLSX original',415);
  const extraction=workbookExtractionSchema.parse(input);
  if (extraction.source_id!==`sha256:${original.checksum}`) throw new EvidenceInputError('Workbook extraction checksum does not match the immutable original');
  if (extraction.has_macros) throw new EvidenceInputError('Macro workbooks are unsupported',415);
  const seen=new Set<string>(), errors=new Set(['#REF!','#DIV/0!','#VALUE!','#N/A','#NAME?','#NUM!','#NULL!']);
  const hasIssue=(code:string,cell_id?:string)=>extraction.issues.some(issue=>issue.code===code&&issue.cell_id===cell_id);
  for (const cell of extraction.cells) {
    const expected=`${extraction.source_id}:${cell.sheet}!${cell.cell}`;
    const letters=cell.cell.match(/^[A-Z]+/)![0];
    const column=[...letters].reduce((total,letter)=>total*26+letter.charCodeAt(0)-64,0);
    if (cell.id!==expected||seen.has(cell.id)||column>16384||Number(cell.cell.slice(letters.length))>1048576) throw new EvidenceInputError('Cell ID or coordinate does not match the workbook source');
    seen.add(cell.id);
    if (cell.formula&&cell.raw_value!==null) throw new EvidenceInputError('Formula cells must preserve formula and cache separately');
    if (cell.formula&&cell.cached_value===null&&!hasIssue('MISSING_FORMULA_CACHE',cell.id)) throw new EvidenceInputError('Missing formula cache must remain flagged');
    if ([cell.raw_value,cell.cached_value].some(value=>typeof value==='string'&&errors.has(value))&&!hasIssue('STORED_ERROR',cell.id)) throw new EvidenceInputError('Stored workbook error must remain flagged');
    if (cell.formula?.includes('[')&&cell.formula.includes(']')&&!hasIssue('EXTERNAL_FORMULA_REFERENCE',cell.id)) throw new EvidenceInputError('External formula reference must remain flagged');
  }
  if (extraction.external_links&&!hasIssue('EXTERNAL_LINKS')) throw new EvidenceInputError('External workbook links must remain flagged');
  if (extraction.issues.some(issue=>issue.cell_id&&!seen.has(issue.cell_id))) throw new EvidenceInputError('Workbook issue refers to an unknown cell');
  const bytes=new TextEncoder().encode(JSON.stringify(extraction));
  const hash=await checksum(bytes);
  const sourceKey=await checksum(new TextEncoder().encode(`${original.source_id}\n${hash}`));
  const metadata={...original,source_type:'supplied_workbook',source_id:`workbook-cells:${sourceKey}`,checksum:hash,document_title:`Workbook cell extraction: ${extraction.filename}`,uri_or_file:`evidence:${original.source_id}#sha256:${original.checksum}`,locator:null,mime_type:'application/json',quality_status:'partial',usage_rights:'restricted',rights_scope:'Internal extraction metadata; original rights still apply. Cell assertions have not been independently verified.',published_at:null};
  const source=await ingestSource(db,metadata,bytes,actor);
  return {source,original_source_id:original.source_id,original_checksum:original.checksum,cell_count:extraction.cells.length,extraction_validation:'lineage_and_contract_only',financial_mapping_status:extraction.financial_mapping_status,recalculation:'not_performed',clean_validation:false};
}
export async function checksum(bytes:Uint8Array):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('');}
/** D1 stores bounded originals; larger files need a configured private object store. */
export async function ingestSource(db:D1Database,input:unknown,bytes:Uint8Array,actor:string):Promise<ResearchSource>{
  if(!bytes.length||bytes.length>MAX_ORIGINAL_BYTES)throw new EvidenceInputError('Original must be 1–262144 bytes; larger sources require private object storage',413);
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
