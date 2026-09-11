import {validateResearchJudgment} from './research-rubric';
import {modelReceiptsForReview} from './research-model-runs';
import {checksum,publicSourceProblems} from './research-sources';
import {validateResearchPackage} from './research-package';
export async function packageForReview(db:D1Database, revisionId:string, body:string, snapshotId:unknown, publicRelease=false) {
 if(typeof snapshotId!=='string')throw new Error('Select the exact evidence package snapshot for review');
 const row=await db.prepare('SELECT snapshot_id,body_checksum,package_json FROM research_package_snapshots WHERE revision_id=? AND snapshot_id=?').bind(revisionId,snapshotId).first<{snapshot_id:string;body_checksum:string;package_json:string}>();
 if(!row||row.body_checksum!==await checksum(new TextEncoder().encode(body)))throw new Error('Evidence package is missing or no longer matches the revision body');
 const p=validateResearchPackage(JSON.parse(row.package_json));
 const issues=validateResearchJudgment(p);
 if(issues.length)throw new Error('Research judgment requires correction: '+issues.slice(0,5).map(i=>i.path+' ('+i.code+')').join('; '));
 if(!p.sources.length||!p.facts.some(f=>['reported_actual','management_guidance','consensus'].includes(f.kind)&&f.source_id&&f.locator&&f.value!==null))throw new Error('Financial review requires a source-ledger fact; an empty package cannot support the narrative');
 const modelIssues=await modelReceiptsForReview(db,row.snapshot_id,p);
 if(modelIssues.length)throw new Error(modelIssues.join('; '));
 if(publicRelease){
  if(p.visibility==='restricted_client'||p.sources.some(s=>publicSourceProblems(s).length))throw new Error('Evidence rights or source quality block public release');
  if(p.facts.some(f=>f.kind==='unresolved'||f.value===null&&f.unit!=='text'))throw new Error('Resolve missing financial facts before public release');
 }
 return {snapshotId:row.snapshot_id,package:p};
}
