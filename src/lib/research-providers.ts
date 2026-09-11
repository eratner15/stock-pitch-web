/** Fixed-origin, read-only evidence discovery. No user URLs or write endpoints. */
export type Provider = 'sec'|'fmp'|'fred'|'levy';
export interface ProviderConfig {SEC_USER_AGENT?:string;FMP_API_KEY?:string;FRED_API_KEY?:string;LEVY_PASSWORD?:string;LEVY?:{fetch:typeof fetch}}
export type Discovery = {provider:Provider;operation:string;availability:'available'|'unconfigured'|'unauthorized'|'unavailable'|'invalid_response';retrievedAt:string|null;asOf:string|null;freshness:'fresh'|'stale'|'unknown';sourceUri:string;usageRights:'public'|'internal'|'unknown';checksum:string|null;data:unknown|null;reason:string|null};
const ORIGINS={sec:'https://data.sec.gov',fmp:'https://financialmodelingprep.com',fred:'https://api.stlouisfed.org',levy:'https://levy.levincap.com'};
export function providerCapabilities(config:ProviderConfig){return (Object.keys(ORIGINS) as Provider[]).map(provider=>({provider,state:(provider==='sec'?!!config.SEC_USER_AGENT:provider==='fmp'?!!config.FMP_API_KEY:provider==='fred'?!!config.FRED_API_KEY:!!config.LEVY_PASSWORD)?'configured_unverified':'unconfigured',entitlement:'not_verified',scope:provider==='levy'?'private_note_metadata_only':'read_only_evidence_discovery'}));}
export function freshness(asOf:string|null, now:string, maxAgeMs?:number):'fresh'|'stale'|'unknown'{
 if(!asOf||maxAgeMs===undefined||!Number.isFinite(maxAgeMs)||maxAgeMs<0)return 'unknown';
 const age=Date.parse(now)-Date.parse(asOf);if(!Number.isFinite(age)||age<0)return 'unknown';return age>maxAgeMs?'stale':'fresh';
}
function ticker(value:string){if(!/^[A-Za-z0-9][A-Za-z0-9.^-]{0,19}$/.test(value))throw new Error('Invalid security symbol');return value.toUpperCase();}
async function boundedJSON(response:Response){
 const reader=response.body?.getReader();if(!reader)throw Error('Empty');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000){await reader.cancel();throw Error('Too large');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
 return {data:JSON.parse(new TextDecoder().decode(bytes)),checksum:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')};
}
type Options={fetcher?:typeof fetch;now?:string;maxAgeMs?:number};
async function discover(provider:Provider,operation:string,url:URL,config:ProviderConfig,options:Options,project:(data:any)=>{data:unknown;asOf:string|null}):Promise<Discovery>{
 if(url.origin!==ORIGINS[provider]||url.username||url.password)throw Error('Unsupported provider URL');
 const sourceUri=url.toString(),headers:Record<string,string>={Accept:'application/json'};
 const result:Discovery={provider,operation,availability:'unconfigured',retrievedAt:null,asOf:null,freshness:'unknown',sourceUri,usageRights:provider==='sec'?'public':provider==='levy'?'internal':'unknown',checksum:null,data:null,reason:'Provider credential/contact configuration missing'};
 if(provider==='sec'){if(!config.SEC_USER_AGENT)return result;headers['User-Agent']=config.SEC_USER_AGENT;}
 if(provider==='fmp'){if(!config.FMP_API_KEY)return result;url.searchParams.set('apikey',config.FMP_API_KEY);}
 if(provider==='fred'){if(!config.FRED_API_KEY)return result;url.searchParams.set('api_key',config.FRED_API_KEY);}
 if(provider==='levy'){if(!config.LEVY_PASSWORD)return result;headers.Authorization='Basic '+btoa('research:'+config.LEVY_PASSWORD);}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const transport=options.fetcher??(provider==='levy'&&config.LEVY?config.LEVY.fetch.bind(config.LEVY):fetch);
  const response=await transport(url.toString(),{method:'GET',headers,redirect:'error',signal:controller.signal});
  if(!response.ok)return {...result,availability:[401,403].includes(response.status)?'unauthorized':'unavailable',reason:'Provider request rejected (HTTP '+response.status+')'};
  const parsed=await boundedJSON(response);let projected;
  try{projected=project(parsed.data);}catch{return {...result,availability:'invalid_response',reason:'Provider response did not match expected evidence shape'};}
  const now=options.now??new Date().toISOString();
  return {...result,availability:'available',retrievedAt:now,asOf:projected.asOf,freshness:freshness(projected.asOf,now,options.maxAgeMs),checksum:parsed.checksum,data:projected.data,reason:null};
 }catch{return {...result,availability:'unavailable',reason:'Provider unavailable, redirected, oversized, or invalid JSON'};}
 finally{clearTimeout(timer);}
}
/** Accepts CIK instead of assuming every issuer files a US 10-K. */
export function discoverFilings(cik:string,config:ProviderConfig,options:Options={}){
 if(!/^\d{1,10}$/.test(cik))throw Error('SEC CIK required');
 return discover('sec','submissions',new URL('/submissions/CIK'+cik.padStart(10,'0')+'.json',ORIGINS.sec),config,options,data=>{
  const recent=data?.filings?.recent;if(!recent||!Array.isArray(recent.accessionNumber)||!Array.isArray(recent.form)||!Array.isArray(recent.filingDate)||!Array.isArray(recent.primaryDocument))throw Error();
  const records=recent.accessionNumber.map((accession:string,i:number)=>({accession,form:recent.form[i],filingDate:recent.filingDate[i],primaryDocument:recent.primaryDocument[i]}));
  if(records.some((r:any)=>typeof r.accession!=='string'||typeof r.form!=='string'||typeof r.filingDate!=='string'||typeof r.primaryDocument!=='string'))throw Error();
  return {data:{cik,records,coverage:'recent submissions only; older filing files not fetched',acceptedAnnualForms:['10-K','20-F','40-F'],acceptedInterimForms:['10-Q','6-K']},asOf:records[0]?.filingDate??null};
 });
}
export function discoverProfile(symbol:string,config:ProviderConfig,options:Options={}){
 const url=new URL('/stable/profile',ORIGINS.fmp);url.searchParams.set('symbol',ticker(symbol));
 return discover('fmp','profile',url,config,options,data=>{if(!Array.isArray(data)||data.length!==1||data[0]?.symbol?.toUpperCase()!==ticker(symbol))throw Error();const r=data[0];return {data:{symbol:r.symbol,companyName:r.companyName??null,currency:r.currency??null,exchange:r.exchange??null,isin:r.isin??null,cik:r.cik??null},asOf:null};});
}
export function discoverMacro(seriesId:string,config:ProviderConfig,options:Options={}){
 if(!/^[A-Za-z0-9_]{1,30}$/.test(seriesId))throw Error('Invalid FRED series ID');const url=new URL('/fred/series/observations',ORIGINS.fred);url.searchParams.set('series_id',seriesId);url.searchParams.set('file_type','json');url.searchParams.set('sort_order','desc');url.searchParams.set('limit','10');
 return discover('fred','observations',url,config,options,data=>{if(!Array.isArray(data?.observations))throw Error();return {data:{seriesId,observations:data.observations.map((o:any)=>{if(typeof o.date!=='string'||typeof o.value!=='string')throw Error();return {date:o.date,value:o.value.trim()!==''&&/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(o.value.trim())&&Number.isFinite(Number(o.value))?Number(o.value):null};}),units:'not resolved; load series metadata before modeling'},asOf:data.observations[0]?.date??null};});
}
/** Internal discovery only: strips email subjects, bodies, summaries and web links. */
export function discoverLevyNotes(symbol:string,config:ProviderConfig,options:Options={}){
 const url=new URL('/api/notes',ORIGINS.levy);url.searchParams.set('ticker',ticker(symbol));url.searchParams.set('limit','20');
 return discover('levy','note_metadata',url,config,options,data=>{
  if(!Array.isArray(data?.notes))throw Error();
  const notes=data.notes.map((r:any)=>{if(typeof r.id!=='string'||typeof r.firm!=='string')throw Error();return {noteId:r.id,firm:r.firm,noteType:typeof r.note_type==='string'?r.note_type:null,receivedAt:typeof r.received_at==='string'?r.received_at:null,locator:'Levy note ID '+r.id,usageRights:'internal'};});
  return {data:{notes,visibility:'internal',originals:'Not retrieved: open the authenticated Levy desk for source review'},asOf:notes[0]?.receivedAt??null};
 });
}
