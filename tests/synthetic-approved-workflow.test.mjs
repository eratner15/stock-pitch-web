import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {runSyntheticApprovedWorkflow} from '../scripts/synthetic-approved-workflow.mjs';
test('one unchanged model package crosses evidence, identity, draft, receipt, independent review, delivery and tracker',async()=>{
 const result=await runSyntheticApprovedWorkflow({fixtures:resolve('tests/fixtures/approved-workflow'),exerciseRevocation:true});
 assert.equal(result.envelope.revision_status,'approved');
 assert.equal(result.envelope.purpose,'internal_team_delivery');
 assert.equal(result.context.post_export_edit_revocation_verified,true);
 assert.equal(result.context.production_writes,false);
 assert.deepEqual(result.context.transitions,['submitted','independently_approved']);
 assert.ok(Object.values(result.context.unchanged).every(Boolean));
 assert.equal(result.receipt.assurance,'deterministic_arithmetic_only');
 assert.ok(result.tracker.items.length>0);
});
