import { z } from 'zod';
import { packageSchema } from './research-package';
const identityId=z.string().min(1).max(160);
const ticker=z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9.\-/:]*$/).transform(s=>s.toUpperCase());
const alias=z.object({ticker,valid_from:z.iso.date().nullable(),valid_to:z.iso.date().nullable()}).strict().superRefine((a,c)=>{if(a.valid_from&&a.valid_to&&a.valid_from>a.valid_to)c.addIssue({code:'custom',message:'Alias starts after it ends'});});
const companySchema=packageSchema.shape.companies.element;
const securitySchema=packageSchema.shape.securities.element.extend({exchange:z.string().trim().min(1).max(100).transform(v=>v.toUpperCase()),aliases:z.array(alias).min(1).max(100)});
export const identityRegistrationSchema=z.object({company:companySchema,security:securitySchema}).strict().superRefine((r,c)=>{if(r.company.company_id!==r.security.company_id)c.addIssue({code:'custom',message:'Security company mismatch'});});
export type ResearchIdentity={security_id:string;company_id:string;company_name:string;exchange:string;share_class:string;currency:string|null;reporting_currency:string|null;adr_ratio:number|null;verification_status:'analyst_supplied';ticker:string;alias_id:string;valid_from:string|null;valid_to:string|null;regulator_ids:{regulator:string;value:string}[]};
export type IdentityResolution={status:'resolved';identity:ResearchIdentity}|{status:'ambiguous';candidates:ResearchIdentity[]}|{status:'unresolved';reason:string};
/** Ticker is a dated alias, never an identity. Exactly one match is required. */
export async function resolveResearchIdentity(db:D1Database,input:{ticker:string;exchange?:string;securityId?:string;asOf:string}):Promise<IdentityResolution>{
 const query=z.object({ticker,exchange:z.string().trim().min(1).transform(v=>v.toUpperCase()).optional(),securityId:identityId.optional(),asOf:z.iso.date()}).strict().parse(input);
 const rows=(await db.prepare('SELECT s.security_id,s.company_id,c.name AS company_name,s.exchange,s.share_class,s.currency,s.reporting_currency,s.adr_ratio,s.verification_status,a.alias_id,a.ticker,a.valid_from,a.valid_to FROM research_ticker_aliases a JOIN research_securities s ON s.security_id=a.security_id JOIN research_companies c ON c.company_id=s.company_id WHERE a.ticker=? AND (a.valid_from IS NULL OR a.valid_from<=?) AND (a.valid_to IS NULL OR a.valid_to>=?) AND (? IS NULL OR s.exchange=?) AND (? IS NULL OR s.security_id=?) ORDER BY s.exchange,s.security_id').bind(query.ticker,query.asOf,query.asOf,query.exchange??null,query.exchange??null,query.securityId??null,query.securityId??null).all<Omit<ResearchIdentity,'regulator_ids'>>()).results;
 if(!rows.length)return {status:'unresolved',reason:'No active registered security matches the supplied alias, date and market'};
 const candidates:ResearchIdentity[]=[];for(const row of rows){const refs=(await db.prepare('SELECT regulator,regulator_id AS value FROM research_company_regulator_ids WHERE company_id=? ORDER BY regulator,regulator_id').bind(row.company_id).all<{regulator:string;value:string}>()).results;candidates.push({...row,regulator_ids:refs});}
 return candidates.length===1?{status:'resolved',identity:candidates[0]}:{status:'ambiguous',candidates};
}
export async function registerResearchIdentity(db:D1Database,input:unknown,actor:string):Promise<{security_id:string;alias_ids:string[]}>{
 const {company,security}=identityRegistrationSchema.parse(input);const at=new Date().toISOString();
 const existing=await db.prepare('SELECT name FROM research_companies WHERE company_id=?').bind(company.company_id).first<{name:string}>();
 if(existing&&existing.name!==company.name)throw new Error('Company ID already has a different name');
 if(await db.prepare('SELECT security_id FROM research_securities WHERE security_id=?').bind(security.security_id).first())throw new Error('Security ID already registered; add an alias to rename');
 const statements:D1PreparedStatement[]=[];if(!existing)statements.push(db.prepare('INSERT INTO research_companies(company_id,name,created_by,created_at) VALUES (?,?,?,?)').bind(company.company_id,company.name,actor,at));
 for(const ref of company.regulator_ids){const prior=await db.prepare('SELECT company_id FROM research_company_regulator_ids WHERE regulator=? AND regulator_id=?').bind(ref.regulator,ref.value).first<{company_id:string}>();if(prior&&prior.company_id!==company.company_id)throw new Error('Regulator ID belongs to another company');if(!prior)statements.push(db.prepare('INSERT INTO research_company_regulator_ids(company_id,regulator,regulator_id) VALUES (?,?,?)').bind(company.company_id,ref.regulator,ref.value));}
 statements.push(db.prepare('INSERT INTO research_securities(security_id,company_id,exchange,share_class,currency,reporting_currency,adr_ratio,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(security.security_id,company.company_id,security.exchange,security.share_class,security.currency,security.reporting_currency,security.adr_ratio,actor,at));
 const aliases:string[]=[];for(const a of security.aliases){const aliasId=crypto.randomUUID();aliases.push(aliasId);statements.push(db.prepare('INSERT INTO research_ticker_aliases(alias_id,security_id,ticker,valid_from,valid_to,created_by,created_at) VALUES (?,?,?,?,?,?,?)').bind(aliasId,security.security_id,a.ticker,a.valid_from,a.valid_to,actor,at));}
 statements.push(db.prepare('INSERT INTO research_identity_events(event_id,security_id,actor_id,event_type,before_json,after_json,created_at) VALUES (?,?,?,\'registration\',NULL,?,?)').bind(crypto.randomUUID(),security.security_id,actor,JSON.stringify({company,security}),at));
 await db.batch(statements);return {security_id:security.security_id,alias_ids:aliases};
}
export async function renameResearchAlias(db:D1Database,input:unknown,actor:string):Promise<string>{
 const b=z.object({alias_id:identityId,valid_to:z.iso.date(),replacement:alias,reason:z.string().min(1).max(2000)}).strict().parse(input);
 const old=await db.prepare('SELECT alias_id,security_id,ticker,valid_from,valid_to FROM research_ticker_aliases WHERE alias_id=?').bind(b.alias_id).first<{alias_id:string;security_id:string;ticker:string;valid_from:string|null;valid_to:string|null}>();
 if(!old||old.valid_to!==null||old.valid_from&&b.valid_to<old.valid_from||!b.replacement.valid_from||b.replacement.valid_from<=b.valid_to)throw new Error('Rename requires an open alias and a later replacement start');
 const nextId=crypto.randomUUID(),at=new Date().toISOString();
 // Compare-and-set closure; all subsequent writes depend on that exact update succeeding.
 const results=await db.batch([
  db.prepare('UPDATE research_ticker_aliases SET valid_to=? WHERE alias_id=? AND valid_to IS NULL').bind(b.valid_to,b.alias_id),
  db.prepare('INSERT INTO research_ticker_aliases(alias_id,security_id,ticker,valid_from,valid_to,created_by,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1').bind(nextId,old.security_id,b.replacement.ticker,b.replacement.valid_from,b.replacement.valid_to,actor,at),
  db.prepare('INSERT INTO research_identity_events(event_id,security_id,alias_id,actor_id,event_type,before_json,after_json,created_at) SELECT ?,?,?,?,\'alias_rename\',?,?,? WHERE changes()=1').bind(crypto.randomUUID(),old.security_id,b.alias_id,actor,JSON.stringify(old),JSON.stringify(b),at)
 ]);if(!results[0].meta.changes)throw new Error('Alias changed concurrently');return nextId;
}
