import { z } from 'zod';
import { validateResearchPackage, type ResearchPackage, type FinancialFact } from './research-package';
import { checksum } from './research-sources';
export const MODEL_ENGINE_VERSION = 'lcs-industrial-dcf-sotp-ts/1.0.0';
const id=z.string().min(1).max(160);
const bridge={shares:id,debt:id,cash:id,minority_interest:id,nonoperating_assets:id};
export const modelRunSchema=z.object({snapshot_id:id,model_id:id,as_of:z.iso.datetime({offset:true}),sector:z.literal('industrial'),mapping:z.discriminatedUnion('method',[
 z.object({method:z.literal('dcf'),...bridge,fcf:z.array(id).min(1).max(30),wacc:id,terminal_growth:id,cash_flow_type:z.literal('unlevered')}).strict(),
 z.object({method:z.literal('sotp'),...bridge,segment_values:z.array(id).min(1).max(100)}).strict()
]),outputs:z.object({enterprise_value:id,equity_value:id,price:id}).strict()}).strict();
function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';return JSON.stringify(value);}
const equalSet=(a:string[],b:string[])=>a.length===new Set(a).size&&b.length===new Set(b).size&&a.length===b.length&&a.every(x=>b.includes(x));
const near=(a:number,b:number)=>Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));
function requireCondition(value:unknown,message:string):asserts value {if(!value)throw new Error(message);}
/** No network, inferred defaults, external formula execution or evidence certification. */
export function calculateModelReceipt(pkg:ResearchPackage,input:unknown){
 const r=modelRunSchema.parse(input),m=r.mapping;
 requireCondition(r.as_of===pkg.analysis_as_of,'Model as-of differs from package');
 const model=pkg.models.find(x=>x.model_id===r.model_id);requireCondition(model,'Unknown model');
 const ids=Object.entries(m).flatMap(([key,value])=>['method','cash_flow_type'].includes(key)?[]:Array.isArray(value)?value:[value]);
 requireCondition(equalSet(model.input_ids,ids),'Model input dependencies differ from mapping');
 requireCondition(equalSet(model.output_ids,Object.values(r.outputs)),'Model output dependencies differ from mapping');
 const security=pkg.securities.find(s=>s.security_id===pkg.security_id)!;
 requireCondition(security.currency&&security.currency===security.reporting_currency&&(!security.adr_ratio||security.adr_ratio===1),'Cross-currency or ADR conversion needs an explicit supported adapter');
 const facts=new Map(pkg.facts.map(f=>[f.fact_id,f]));
 const fact=(key:string,unit:string):FinancialFact=>{
  const f=facts.get(key);requireCondition(f&&f.value!==null&&Number.isFinite(f.value),'Missing numeric fact '+key);
  requireCondition(f.company_id===pkg.company_id&&f.security_id===pkg.security_id,'Model fact identity mismatch');
  requireCondition(f.unit===unit&&(unit==='currency'?f.currency===security.currency:f.currency===null),'Model fact unit/currency mismatch');
  requireCondition(f.kind!=='unresolved','Unresolved model fact');return f;
 };
 const shares=fact(m.shares,'shares'),debt=fact(m.debt,'currency'),cash=fact(m.cash,'currency'),minority=fact(m.minority_interest,'currency'),assets=fact(m.nonoperating_assets,'currency');
 const scale=debt.scale,asOf=pkg.analysis_as_of.slice(0,10);
 const mapped=ids.map(key=>facts.get(key)!);
 for(const f of mapped){
  requireCondition(f,'Missing mapped input');
  if(f.kind==='analyst_assumption')requireCondition(pkg.assumptions.some(a=>a.fact_id===f.fact_id&&a.rationale.trim()&&f.rationale?.trim()),'Unregistered model assumption');
  else {requireCondition(['reported_actual','management_guidance','consensus'].includes(f.kind),'Model input must be sourced or registered assumption');const source=pkg.sources.find(s=>s.source_id===f.source_id);requireCondition(source?.published_at&&source.retrieved_at&&Date.parse(source.published_at)<=Date.parse(pkg.analysis_as_of)&&Date.parse(source.retrieved_at)<=Date.parse(pkg.analysis_as_of),'Model source date unavailable or after as-of');}
 }
 for(const f of [shares,debt,cash,minority,assets])requireCondition(f.scale===scale&&f.period.kind==='instant'&&f.period.end===asOf&&f.segment===null,'Bridge facts require common scale and as-of instant period');
 requireCondition(shares.value!>0&&[debt,cash,minority,assets].every(f=>f.value!>=0),'Invalid shares or balance bridge');
 let ev:number;let sensitivity:null|{wacc:number;growth:number;price:number|null}[][]=null;
 const toPrice=(v:number)=>(v-debt.value!-minority.value!+cash.value!+assets.value!)/shares.value!;
 if(m.method==='dcf'){
  const w=fact(m.wacc,'ratio'),g=fact(m.terminal_growth,'ratio');
  for(const f of [w,g])requireCondition(f.scale==='unit'&&f.period.kind==='instant'&&f.period.end===asOf&&f.segment===null,'Rates require as-of instant period');
  const flows=m.fcf.map(key=>fact(key,'currency'));
  let previousEnd=asOf;
  for(const f of flows){const next=new Date(previousEnd+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);const start=next.toISOString().slice(0,10);const end=new Date(previousEnd+'T00:00:00Z');end.setUTCFullYear(end.getUTCFullYear()+1);requireCondition(f.scale===scale&&f.segment===null&&f.period.kind==='forecast'&&f.period.start===start&&f.period.end===end.toISOString().slice(0,10),'DCF requires contiguous annual future cash flows');previousEnd=f.period.end;}
  requireCondition(flows.at(-1)!.value!>0,'Terminal FCF must be positive');
  const valuation=(rate:number,growth:number)=>{requireCondition(rate>0&&rate<1&&rate>growth&&growth>-1,'Invalid terminal rate pairing');const value=flows.reduce((sum,f,i)=>sum+f.value!/((1+rate)**(i+1)),0)+flows.at(-1)!.value!*(1+growth)/(rate-growth)/((1+rate)**flows.length);requireCondition(Number.isFinite(value),'Nonfinite valuation');return value;};
  ev=valuation(w.value!,g.value!);
  sensitivity=Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>{const rate=w.value!+(i-2)*.005,growth=g.value!+(j-2)*.005;try{return {wacc:rate,growth,price:toPrice(valuation(rate,growth))};}catch{return {wacc:rate,growth,price:null};}}));
 }else{
  const segments=m.segment_values.map(key=>fact(key,'currency'));
  requireCondition(new Set(segments.map(f=>f.segment)).size===segments.length,'Duplicate SOTP segments');
  for(const f of segments)requireCondition(f.scale===scale&&f.segment?.trim()&&f.period.kind==='instant'&&f.period.end===asOf&&f.value!>=0,'SOTP segment EV requires named segment and common as-of/scale');
  ev=segments.reduce((sum,f)=>sum+f.value!,0);
 }
 const equity=ev-debt.value!-minority.value!+cash.value!+assets.value!,price=equity/shares.value!;
 const values={enterprise_value:ev,equity_value:equity,price};
 for(const key of ['enterprise_value','equity_value','price'] as const){const f=fact(r.outputs[key],'currency');requireCondition(f.kind==='computed'&&f.metric===key&&f.scale===(key==='price'?'unit':scale)&&f.period.kind==='instant'&&f.period.end===asOf&&f.segment===null,'Output metadata differs from valuation');requireCondition(equalSet(f.input_ids,ids),'Output dependency IDs differ from model inputs');requireCondition(Number.isFinite(values[key])&&near(f.value!,values[key]),'Claimed '+key+' differs from server calculation');}
 return {engine_version:MODEL_ENGINE_VERSION,model_id:r.model_id,request:r,values,sensitivity,assurance:'deterministic_arithmetic_only',limitations:['Sector applicability, evidence truth and economic assumptions require independent reviewer judgment.','Annual end-period discount convention; sensitivity steps are display conventions of 50 basis points.']};
}
export async function recordModelRun(db:D1Database,input:unknown,actor:string){
 const request=modelRunSchema.parse(input);
 const row=await db.prepare('SELECT package_json,created_by FROM research_package_snapshots WHERE snapshot_id=?').bind(request.snapshot_id).first<{package_json:string;created_by:string}>();
 requireCondition(row&&row.created_by===actor,'Only the snapshot author may request its model receipt');
 const pkg=validateResearchPackage(JSON.parse(row.package_json)),result=calculateModelReceipt(pkg,request);
 const packageHash=await checksum(new TextEncoder().encode(canonical(validateResearchPackage(pkg))));
 const receiptId=await checksum(new TextEncoder().encode(JSON.stringify({packageHash,result})));
 await db.prepare('INSERT OR IGNORE INTO research_model_receipts(receipt_id,snapshot_id,model_id,engine_version,package_checksum,receipt_json,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(receiptId,request.snapshot_id,request.model_id,MODEL_ENGINE_VERSION,packageHash,JSON.stringify(result),actor,new Date().toISOString()).run();
 const stored=await db.prepare('SELECT receipt_id FROM research_model_receipts WHERE snapshot_id=? AND model_id=? AND engine_version=?').bind(request.snapshot_id,request.model_id,MODEL_ENGINE_VERSION).first<{receipt_id:string}>();
 requireCondition(stored?.receipt_id===receiptId,'An immutable receipt already exists for a different mapping');
 return {receipt_id:receiptId,...result};
}
/** Fail closed: client qa_status never substitutes for a server calculation receipt. */
export async function modelReceiptsForReview(db:D1Database,snapshotId:string,pkg:ResearchPackage):Promise<string[]>{
 if(!pkg.models.length)return [];
 const hash=await checksum(new TextEncoder().encode(canonical(validateResearchPackage(pkg)))),issues:string[]=[];
 for(const model of pkg.models){
  const row=await db.prepare('SELECT package_checksum,receipt_json FROM research_model_receipts WHERE snapshot_id=? AND model_id=? AND engine_version=?').bind(snapshotId,model.model_id,MODEL_ENGINE_VERSION).first<{package_checksum:string;receipt_json:string}>();
  try{requireCondition(row&&row.package_checksum===hash,'Missing or stale server receipt');const receipt=JSON.parse(row.receipt_json);const calculated=calculateModelReceipt(pkg,receipt.request);requireCondition(JSON.stringify(calculated)===row.receipt_json,'Receipt calculation mismatch');}catch{issues.push('Model '+model.model_id+' requires a matching deterministic server receipt');}
 }
 return issues;
}
