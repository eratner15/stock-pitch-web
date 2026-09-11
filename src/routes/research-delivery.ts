import { Hono } from 'hono';
import { packageForReview } from '../lib/research-review';
import { checksum } from '../lib/research-sources';

// Mounted below the workspace's signed-session, membership and no-store middleware.
export const delivery = new Hono<{Bindings:{DB:D1Database}}>();
delivery.get('/:revisionId', async c => {
 const revision = await c.env.DB.prepare('SELECT id,version,status,body,created_by,reviewed_by,reviewed_at,reviewed_snapshot_id FROM research_revisions WHERE id=?')
  .bind(c.req.param('revisionId')).first<{id:string;version:number;status:string;body:string;created_by:string;reviewed_by:string|null;reviewed_at:string|null;reviewed_snapshot_id:string|null}>();
 if(!revision) return c.json({error:'Revision not found'},404);
 if(!['approved','published'].includes(revision.status)||!revision.reviewed_snapshot_id||!revision.reviewed_by||revision.reviewed_by===revision.created_by||!revision.reviewed_at)
  return c.json({error:'An independently approved revision is required for team delivery'},409);
 try {
  // Recheck current engine/rights gates without modifying the immutable snapshot.
  const reviewed=await packageForReview(c.env.DB,revision.id,revision.body,revision.reviewed_snapshot_id);
  const snapshot=await c.env.DB.prepare('SELECT package_json FROM research_package_snapshots WHERE snapshot_id=?').bind(reviewed.snapshotId).first<{package_json:string}>();
  if(!snapshot) return c.json({error:'Approved snapshot is unavailable'},409);
  const stable=await c.env.DB.prepare('SELECT version,status,reviewed_snapshot_id FROM research_revisions WHERE id=?').bind(revision.id).first<{version:number;status:string;reviewed_snapshot_id:string}>();
  if(!stable||stable.version!==revision.version||stable.status!==revision.status||stable.reviewed_snapshot_id!==reviewed.snapshotId)
   return c.json({error:'Revision changed during export; retry'},409);
  return c.json({schema_version:1,purpose:'internal_team_delivery',snapshot_id:reviewed.snapshotId,revision_id:revision.id,
   revision_version:revision.version,revision_status:revision.status,reviewed_by:revision.reviewed_by,reviewed_at:revision.reviewed_at,
   exported_at:new Date().toISOString(),package_checksum:await checksum(new TextEncoder().encode(snapshot.package_json)),
   package_json:snapshot.package_json,body:revision.body,
   distribution:'Private team export; source rights still govern reuse. This response does not publish or send files.'});
 } catch { return c.json({error:'Approved evidence or model checks no longer pass; return the revision to review'},409); }
});
