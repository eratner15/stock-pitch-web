import {validateResearchPackage,type ResearchPackage} from './research-package';
import {checksum} from './research-sources';
type Row=Record<string,unknown>;
export type InputChange={category:'fact'|'assumption'|'source'|'model'|'package';id:string;change:'added'|'removed'|'changed';fields:string[];before:Row|null;after:Row|null};
function stable(value:unknown):string {if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable((value as Row)[key])).join(',')+'}';return JSON.stringify(value);}
function display(value:unknown):unknown {if(typeof value==='string')return value.length>300?value.slice(0,300)+'…':value;if(Array.isArray(value))return value.slice(0,40).map(display);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,display(v)]));return value;}
/** Structural comparison only. Stable IDs define continuity; equal metric labels do not. */
export function compareResearchInputs(current:ResearchPackage|null,previous:ResearchPackage|null,limit=50){
 const cap=Number.isFinite(limit)?Math.max(1,Math.min(100,Math.floor(limit))):50;
 const common={interpretation:'Structural changes only; no economic or semantic conclusion.',matching:'stable_ids_only',display_values_may_be_truncated:true};
 const empty=(status:string)=>({...common,status,total_count:0,shown_count:0,truncated:false,items:[] as InputChange[]});
 if(!previous)return empty('no_previous_reviewed_package');if(!current)return empty('no_current_matching_package');
 if(current.company_id!==previous.company_id||current.security_id!==previous.security_id)return empty('identity_mismatch');
 const items:InputChange[]=[];
 const compare=(category:InputChange['category'],key:string,oldRows:Row[],newRows:Row[])=>{
  const old=new Map(oldRows.map(row=>[String(row[key]),row])),next=new Map(newRows.map(row=>[String(row[key]),row]));
  for(const id of [...new Set([...old.keys(),...next.keys()])].sort()){
   const before=old.get(id),after=next.get(id);
   const fields=[...new Set([...Object.keys(before??{}),...Object.keys(after??{})])].filter(k=>stable(before?.[k])!==stable(after?.[k])).sort();
   if(fields.length)items.push({category,id,change:!before?'added':!after?'removed':'changed',fields,before:before?display(before) as Row:null,after:after?display(after) as Row:null});
  }
 };
 compare('fact','fact_id',previous.facts,current.facts);
 compare('assumption','assumption_id',previous.assumptions,current.assumptions);
 compare('source','source_id',previous.sources,current.sources);
 compare('model','model_id',previous.models,current.models);
 compare('package','id',[{id:'analysis',analysis_as_of:previous.analysis_as_of,model_version:previous.model_version}],[{id:'analysis',analysis_as_of:current.analysis_as_of,model_version:current.model_version}]);
 return {...common,status:'compared',total_count:items.length,shown_count:Math.min(items.length,cap),truncated:items.length>cap,items:items.slice(0,cap)};
}
/** Read-only detail adapter. Never substitutes an arbitrary draft for the prior approved snapshot. */
export async function revisionInputComparison(db:D1Database,revisionId:string,limit=50){
 const row=await db.prepare('SELECT id,previous_id,company_id,security_id,body FROM research_revisions WHERE id=?').bind(revisionId).first<{id:string;previous_id:string|null;company_id:string;security_id:string|null;body:string}>();
 if(!row)return {...compareResearchInputs(null,null,limit),status:'revision_not_found'};
 const previous=row.previous_id?await db.prepare('SELECT id,reviewed_snapshot_id,published_at FROM research_revisions WHERE id=?').bind(row.previous_id).first<{id:string;reviewed_snapshot_id:string|null;published_at:string|null}>():null;
 const old=previous?.published_at&&previous.reviewed_snapshot_id?await db.prepare('SELECT snapshot_id,package_json FROM research_package_snapshots WHERE revision_id=? AND snapshot_id=?').bind(previous.id,previous.reviewed_snapshot_id).first<{snapshot_id:string;package_json:string}>():null;
 const latest=await db.prepare('SELECT snapshot_id,body_checksum,package_json FROM research_package_snapshots WHERE revision_id=? ORDER BY workspace_version DESC LIMIT 1').bind(row.id).first<{snapshot_id:string;body_checksum:string;package_json:string}>();
 const resultIds={current_snapshot_id:latest?.snapshot_id??null,previous_snapshot_id:old?.snapshot_id??null};
 try{
  const prior=old?validateResearchPackage(JSON.parse(old.package_json)):null;
  const hash=await checksum(new TextEncoder().encode(row.body));
  const current=latest&&latest.body_checksum===hash?validateResearchPackage(JSON.parse(latest.package_json)):null;
  if(current&&(current.company_id!==row.company_id||current.security_id!==row.security_id||current.revision_id!==row.id||current.body_checksum!==hash))return {...compareResearchInputs(null,prior,limit),...resultIds,status:'current_package_mismatch'};
  if(prior&&prior.revision_id!==previous!.id)return {...compareResearchInputs(null,null,limit),...resultIds,status:'previous_package_mismatch'};
  return {...compareResearchInputs(current,prior,limit),...resultIds};
 }catch{return {...compareResearchInputs(null,null,limit),...resultIds,status:'invalid_package_contract'};}
}
