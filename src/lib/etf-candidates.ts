import type {Snapshot,Holding} from './etf-discovery';
import {resolveResearchIdentity,type ResearchIdentity} from './research-identities';
const duplicateKey=(h:Holding)=>h.securityId?'security:'+h.securityId:'alias:'+h.ticker+'|'+(h.exchange??'');
/** Historical source metadata only;30 days is a review flag, not a completeness claim. */
export async function resolvedETFCandidates(db:D1Database,snapshot:Snapshot,{offset=0,limit=100,now=new Date().toISOString()}={}){
 if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid candidate page');
 const age=snapshot.asOf===null?null:Math.floor((Date.parse(now)-Date.parse(snapshot.asOf))/86400000);
 const freshness=age===null||!Number.isFinite(age)||age<0?'unknown':age>30?'stale':'within_30_day_review_window';
 const counts=new Map<string,number>();for(const h of snapshot.holdings)if(h.assetType==='equity'&&h.ticker)counts.set(duplicateKey(h),(counts.get(duplicateKey(h))??0)+1);
 const candidates: {holdingIndex:number;holding:Holding;eligible:boolean;identity:ResearchIdentity|null;reason:string}[]=[];
 for(let index=offset;index<Math.min(snapshot.holdings.length,offset+limit);index++){
  const h=snapshot.holdings[index];let identity:ResearchIdentity|null=null,reason='';
  if(h.assetType!=='equity'||!h.ticker)reason='Non-equity or unresolved holding identity';
  else if(snapshot.asOf===null)reason='Holdings date unresolved: cannot resolve a dated ticker alias';
  else if((counts.get(duplicateKey(h))??0)>1)reason='Duplicate holding identity: reconcile source rows before handoff';
  else{
   const resolution=await resolveResearchIdentity(db,{ticker:h.ticker,asOf:snapshot.asOf,...(h.exchange?{exchange:h.exchange}:{}),...(h.securityId?{securityId:h.securityId}:{})});
   if(resolution.status==='resolved'){
    if(h.currency&&resolution.identity.currency&&h.currency!==resolution.identity.currency)reason='Holding currency conflicts with the registered security';
    else {
     const resolved=resolution.identity;
     const aliases=(await db.prepare('SELECT ticker FROM research_ticker_aliases WHERE security_id=? AND (valid_from IS NULL OR valid_from<=?) AND (valid_to IS NULL OR valid_to>=?)').bind(resolved.security_id,snapshot.asOf,snapshot.asOf).all<{ticker:string}>()).results;
     const symbols=new Set(aliases.map(a=>a.ticker));
     const matching=snapshot.holdings.filter(other=>other.assetType==='equity'&&(other.securityId?other.securityId===resolved.security_id:!!other.ticker&&symbols.has(other.ticker)&&(!other.exchange||other.exchange===resolved.exchange)));
     if(matching.length>1)reason='Duplicate resolved security: reconcile source rows before handoff';else identity=resolved;
    }
   }else reason=resolution.status==='ambiguous'?'Multiple share classes or exchanges match: enrich the snapshot identity':'No registered security matches this dated alias';
  }
  candidates.push({holdingIndex:index,holding:h,eligible:!!identity,identity,reason:reason||'Identified equity for research discovery; issuer fundamentals still required'});
 }
 // Aliases within this page that resolve to one security may not double-count it.
 const resolvedCounts=new Map<string,number>();for(const c of candidates)if(c.identity)resolvedCounts.set(c.identity.security_id,(resolvedCounts.get(c.identity.security_id)??0)+1);
 for(const c of candidates)if(c.identity&&(resolvedCounts.get(c.identity.security_id)??0)>1){c.eligible=false;c.reason='Duplicate resolved security: reconcile source rows before handoff';}
 return {scope:'dated_snapshot_discovery_only',asOf:snapshot.asOf,provider:snapshot.provider,completeness:snapshot.completeness,freshness,ageDays:age,reviewWindowDays:30,offset,totalHoldings:snapshot.holdings.length,nextOffset:offset+limit<snapshot.holdings.length?offset+limit:null,candidates};
}
