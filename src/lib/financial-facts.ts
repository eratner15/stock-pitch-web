import { factSchema, type FinancialFact, type ResearchSource } from './research-package';
const scale = {unit:1,thousand:1e3,million:1e6,billion:1e9};
export function normalizeFact(input:unknown):FinancialFact & {normalized_value:number|null} {
  const fact=factSchema.parse(input);
  const normalized_value=fact.value===null?null:fact.value*scale[fact.scale];
  if(normalized_value!==null&&!Number.isFinite(normalized_value))throw new Error('Normalized value overflows');
  return {...fact,normalized_value};
}
export function verifyFinancialFact(claim:FinancialFact,evidence:FinancialFact,source:ResearchSource|null):{verified:boolean;reason:string} {
  const a=normalizeFact(claim),b=normalizeFact(evidence);
  if(!source||a.source_id!==source.source_id||b.source_id!==source.source_id||source.quality_status!=='verified_source')return {verified:false,reason:'Source is absent or unresolved'};
  if(a.value===null||b.value===null||a.kind==='unresolved'||b.kind==='unresolved')return {verified:false,reason:'Missing value or unresolved fact'};
  if(a.accounting_basis==='unknown'||b.accounting_basis==='unknown')return {verified:false,reason:'Unknown accounting basis'};
  const fields=['company_id','security_id','metric','kind','unit','currency','segment','accounting_basis'] as const;
  if(fields.some(k=>a[k]!==b[k]))return {verified:false,reason:'Identity, metric, scope, units, currency or accounting basis mismatch'};
  if(['start','end','kind','fiscal_year'].some(k=>a.period[k as keyof typeof a.period]!==b.period[k as keyof typeof b.period]))return {verified:false,reason:'Fiscal period mismatch'};
  if(!a.locator||!b.locator||a.locator.kind!==b.locator.kind||a.locator.value!==b.locator.value)return {verified:false,reason:'Evidence locator mismatch'};
  const delta=Math.abs(a.normalized_value!-b.normalized_value!);
  return delta<=Math.max(1e-10,Math.abs(b.normalized_value!)*1e-12)?{verified:true,reason:'Typed source evidence matches'}:{verified:false,reason:'Value or sign mismatch'};
}
export function checkSegmentTotal(total:FinancialFact,segments:FinancialFact[],tolerance=1e-8):{passed:boolean;reason:string} {
  if(!segments.length||new Set(segments.map(s=>s.segment)).size!==segments.length||segments.some(s=>s.segment===null))return {passed:false,reason:'Missing or duplicate segments'};
  const normalized=segments.map(normalizeFact),target=normalizeFact(total);
  if(target.normalized_value===null||normalized.some(s=>s.normalized_value===null))return {passed:false,reason:'Missing segment value'};
  if(segments.some(s=>['company_id','metric','kind','currency','unit','accounting_basis'].some(k=>s[k as keyof FinancialFact]!==total[k as keyof FinancialFact])||JSON.stringify(s.period)!==JSON.stringify(total.period)))return {passed:false,reason:'Incomparable segments'};
  return {passed:Math.abs(normalized.reduce((n,s)=>n+s.normalized_value!,0)-target.normalized_value)<=tolerance,reason:'Segment sum compared in base units; consolidation adjustments must be explicit segments'};
}
