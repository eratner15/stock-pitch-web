import {Hono} from 'hono';
import {providerCapabilities,discoverFilings,discoverProfile,discoverMacro,discoverLevyNotes,type ProviderConfig} from '../lib/research-providers';
/** Mount only beneath research membership; Levy results never join public catalog. */
export const providerDiscovery=new Hono<{Bindings:ProviderConfig}>();
providerDiscovery.get('/providers',c=>c.json({providers:providerCapabilities(c.env)}));
providerDiscovery.post('/providers/:provider/discover',async c=>{
 const length=Number(c.req.header('content-length')||0);if(length>4096)return c.json({error:'Request too large'},413);
 const reader=c.req.raw.body?.getReader();if(!reader)return c.json({error:'Missing body'},400);
 const chunks:Uint8Array[]=[];let bytes=0;
 while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>4096){await reader.cancel();return c.json({error:'Request too large'},413);}chunks.push(part.value);}
 const data=new Uint8Array(bytes);let offset=0;for(const part of chunks){data.set(part,offset);offset+=part.length;}const text=new TextDecoder().decode(data);
 try{
  const b=JSON.parse(text);if(typeof b.identifier!=='string')return c.json({error:'Provider identifier required'},400);
  const provider=c.req.param('provider');
  const fn=provider==='sec'?discoverFilings:provider==='fmp'?discoverProfile:provider==='fred'?discoverMacro:provider==='levy'?discoverLevyNotes:null;
  if(!fn)return c.json({error:'Unsupported provider'},400);
  const result=await fn(b.identifier,c.env);return c.json(result,result.availability==='available'?200:503);
 }catch{return c.json({error:'Invalid provider identifier'},400);}
});
