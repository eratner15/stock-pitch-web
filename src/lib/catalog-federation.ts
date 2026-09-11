export type Registry = { documents: any[]; currentViews: any[]; limitations?: string[] };
/** Federation preserves source identity; it never equates two securities by ticker. */
export async function federateCatalog(sources: {owner:string;fetch:()=>Promise<Response>}[]) {
  const documents:any[]=[]; const currentViews:any[]=[]; const availability:{owner:string;status:string}[]=[];
  const responses=await Promise.allSettled(sources.map(s=>s.fetch()));
  for (const [index,result] of responses.entries()) {
    const owner=sources[index].owner;
    if(result.status==='rejected'||!result.value.ok){availability.push({owner,status:'unavailable'});continue;}
    try {
      const data=await result.value.json() as Registry;
      if(!Array.isArray(data.documents)||!Array.isArray(data.currentViews))throw new Error('schema');
      for(const row of data.documents){
        if(row.visibility!=='public'||row.publicationStatus!=='published')continue;
        const url=new URL(row.canonicalUrl,'https://research.levincap.com');
        if(url.protocol!=='https:'||url.hostname!=='research.levincap.com')continue;
        if(typeof row.id!=='string')continue;
        documents.push({...row,id:`${owner}:${row.id}`,sourceOwner:owner,canonicalUrl:url.href});
      }
      for(const row of data.currentViews){
        const url=new URL(row.canonicalUrl,'https://research.levincap.com');
        if(url.protocol!=='https:'||url.hostname!=='research.levincap.com')continue;
        const model=typeof row.modelUrl==='string'?new URL(row.modelUrl,'https://research.levincap.com'):null;
        currentViews.push({...row,canonicalUrl:url.href,modelUrl:model?.protocol==='https:'?model.href:null,sourceOwner:owner});
      }
      availability.push({owner,status:'available'});
    }catch {availability.push({owner,status:'invalid_response'});}
  }
  return {schemaVersion:1,documents,currentViews,availability,partial:availability.some(x=>x.status!=='available')};
}
