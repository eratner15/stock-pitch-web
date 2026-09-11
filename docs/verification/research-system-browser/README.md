# Actual Worker browser integration QA

Run `LOCAL_QA_PORT=8809 node scripts/preview-workspace.mjs`, then
`node scripts/qa-research-system.mjs`. QA accepts only a127.0.0.1 HTTP origin.
Set LOCAL_QA_ORIGIN to override port; LOCAL_QA_OUTPUT selects evidence directory.

The preview bundles actual src/index.ts into Miniflare, with migrations005–009,
local D1/KV, real signed session validation and research membership. Only the
WorkflowAgent generation implementation and catalog service bindings use
synthetic responses. The loopback-only /__fixture/session helper signs two
synthetic users; no production identity, secret, database or provider is used.
Only membership fixtures are seeded directly into local D1. Research creation,
generation, source ingestion, package attachment, tracker and publication all
exercise actual application routes.

Verified: null legacy sector/summary renders; UI creates and generates a draft;
source originals enter through the authenticated evidence endpoint; a rubric-valid
package matches the actual draft body checksum/version/company; package preview
and tracker CSV work; unsaved editor content causes409; a different signed reviewer
approves; public confirmation publishes; anonymous public route returns200 and
no-store; withdrawal makes it404; switching to an empty draft clears stale package
and tracker UI. Browser errors0; desktop1280 and mobile390 have no page overflow.
The mobile screenshot was visually inspected.

Artifacts are entirely synthetic. This verifies wiring and browser behavior, not
live paid-model performance, deployed Access configuration, factual accuracy of
stock research, or public-release authorization. Preview scripts are local tools
and are not imported into or deployed with the Worker.

Stable identity integration also verified (migration010): the browser registers
its synthetic company/security through /api/identities/register before drafting;
intake resolves the alias to that stable security. A second unregistered draft is
provisional, then resolves through the UI after registry entry, preserving its
saved body while incrementing the version and clearing approval. Unit tests cover
cross-exchange ambiguity/share classes, unique provisional IDs, explicit security
selection, author-only resolution, stale versions and published-edit denial.
