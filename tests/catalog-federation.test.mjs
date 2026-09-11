import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
const built=await build({entryPoints:['src/lib/catalog-federation.ts'],bundle:true,format:'esm',write:false,platform:'node'});
const {federateCatalog}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
test('partial registries preserve identity and exclude private or hostile links',async()=>{
 const row={id:'same',ticker:'A',visibility:'public',publicationStatus:'published',canonicalUrl:'/a'};
 const sources=['one','two'].map(owner=>({owner,fetch:async()=>Response.json({documents:[row,{...row,id:'private',visibility:'private'},{...row,id:'hostile',canonicalUrl:'javascript:alert(1)'}],currentViews:[]})}));
 sources.push({owner:'offline',fetch:async()=>{throw Error('unavailable')}});
 const result=await federateCatalog(sources);assert.equal(result.documents.length,2);assert.notEqual(result.documents[0].id,result.documents[1].id);assert.equal(result.partial,true);
});
