// Actual Worker, loopback only; disposable D1 and synthetic generation/membership.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
const port=Number(process.env.LOCAL_QA_PORT||8799);
const secret='local-fixture-session-secret-never-production';
const generated='SYNTHETIC QA OUTPUT. Not investment research. Revenue fixture is supplied for workflow testing. No house view is proposed.';
const bundle=await build({entryPoints:['src/index.ts'],bundle:true,write:false,format:'esm',platform:'node',external:['cloudflare:workers','node:*'],loader:{'.md':'text'},plugins:[{name:'local-synthetic-generation',setup(b){b.onLoad({filter:/\/agents\/workflow-agent\.ts$/},()=>({contents:`import {DurableObject} from 'cloudflare:workers'; export class WorkflowAgent extends DurableObject { async fetch(){ return Response.json({analysis:${JSON.stringify(generated)}}); } }`,loader:'ts'}));}}]});
const legacy={id:'legacy-synthetic',ticker:'LEGACY',title:'Synthetic legacy fixture',sector:null,summary:null,canonicalUrl:'https://research.levincap.com/spread/LEGACY',visibility:'public',publicationStatus:'published',publishedAt:'2026-01-01',updatedAt:null,companyId:null,securityId:null};
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-04-10',compatibilityFlags:['nodejs_compat'],bindings:{SESSION_SECRET:secret,ANTHROPIC_API_KEY:'synthetic-unused',RESEARCH_PUBLICATION_ENABLED:'true'},d1Databases:['DB'],kvNamespaces:['REQUESTS'],durableObjects:{WorkflowAgent:'WorkflowAgent'},serviceBindings:{RESEARCH_CATALOG:async()=>Response.json({documents:[],currentViews:[],scope:'Synthetic QA catalog'}),RESEARCH_LEGACY:async()=>Response.json({documents:[legacy],currentViews:[]})}});
const db=await mf.getD1Database('DB');
for(const file of ['005_research_desk.sql','006_research_workspace.sql','007_research_evidence.sql','008_reviewed_package.sql','009_research_tracker.sql']){
 const sql=readFileSync('src/db/migrations/'+file,'utf8').replace(/--[^\n]*/g,'');
 for(const statement of sql.split(/^(007|009)/.test(file)?'\n':';').filter(s=>s.trim()))await db.prepare(statement).run();
}
await db.prepare("INSERT INTO research_members(user_id,role) VALUES ('fixture-author','analyst'),('fixture-reviewer','reviewer')").run();
const authBundle=await build({entryPoints:['src/lib/auth.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const auth=await import('data:text/javascript;base64,'+Buffer.from(authBundle.outputFiles[0].text).toString('base64'));
const sessions={author:await auth.signSession('fixture-author','fixture-author@example.test',secret),reviewer:await auth.signSession('fixture-reviewer','fixture-reviewer@example.test',secret)};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:'+port);
  if(url.pathname==='/__fixture/session'){
   const role=url.searchParams.get('role');if(!['author','reviewer','anonymous'].includes(role)){res.writeHead(400);res.end('Invalid fixture role');return;}
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','set-cookie':'sp_session='+(sessions[role]??'')+'; Path=/; HttpOnly; SameSite=Lax'});res.end(JSON.stringify({role}));return;
  }
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
  const response=await mf.dispatchFetch(url.toString(),{method:req.method,headers:req.headers,...(body.length?{body}: {})});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){console.error('Local preview request failed:',error.message);res.writeHead(500);res.end('Local preview error');}
});
server.listen(port,'127.0.0.1',()=>console.log('LOCAL SYNTHETIC QA ONLY http://127.0.0.1:'+port+'/research/workspace'));
async function stop(){server.close();await mf.dispose();process.exit(0)}process.on('SIGTERM',stop);process.on('SIGINT',stop);
