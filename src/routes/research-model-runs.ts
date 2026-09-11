import { Hono } from 'hono';
import { recordModelRun } from '../lib/research-model-runs';
/** Mount beneath workspace signed-session/membership middleware. */
export const modelRuns=new Hono<{Bindings:{DB:D1Database};Variables:{user:{id:string;email:string}|null;role:string}}>();
modelRuns.post('/model-runs',async c=>{
 c.header('cache-control','private, no-store');
 if(!c.get('user'))return c.json({error:'Research sign-in required'},401);
 if(!['analyst','reviewer','admin'].includes(c.get('role')))return c.json({error:'Research membership required'},403);
 if(c.req.header('origin')!==new URL(c.req.url).origin)return c.json({error:'Same-origin request required'},403);
 if(!c.req.header('content-type')?.startsWith('application/json'))return c.json({error:'JSON mapping required'},415);
 try{
  const reader=c.req.raw.body?.getReader();if(!reader)return c.json({error:'Mapping required'},400);
  let size=0;const parts:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();return c.json({error:'Mapping exceeds 32 KiB'},413);}parts.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  return c.json(await recordModelRun(c.env.DB,JSON.parse(new TextDecoder().decode(bytes)),c.get('user')!.id),201);
 }catch{return c.json({error:'Model receipt rejected: snapshot ownership, mapping, dates, dimensions, dependencies or calculated outputs did not validate'},400);}
});
