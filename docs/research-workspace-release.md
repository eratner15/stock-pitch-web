# Research workspace draft release

Not production-ready. No production deployment/publication authorized or performed.

## Implemented

`/research/workspace` requires a valid existing signed session **and** a live `research_members` row. Public sign-up is not team membership. Same-origin writes, no-store responses, bounded inputs, parameterized SQL, immutable published bodies, optimistic versions and audit events protect the new workflow.

ETF discovery searches source-attributed imported snapshots. Full/partial/unknown coverage, as-of/retrieval dates, asset class and unresolved identities remain explicit. Only identified equities can hand off to a draft. It is **not an automated/live ETF holdings service**.

Earnings drafts save sources and snapshot provenance, reuse WorkflowAgent, show prior published text beside the draft, require a different reviewer, invalidate approval on edits, and publish to `/research/published/:id` only if `RESEARCH_PUBLICATION_ENABLED=true` and the reviewer explicitly confirms public suitability. Default configuration is false. Withdrawal removes public access without a cache TTL delay. Failed generation retries the same revision; abandoned claims have explicit author recovery after 15 minutes. Model/API output is never automatically reviewed.

Existing direct agent routes are disabled; run streaming now resolves the owned stored run; portfolio workflows/position reads require team membership; missing ADMIN_KEY fails closed. These changes need staging regression testing with existing clients before production.

## Verification and preview

`npm run verify`: full TypeScript, 7 tests, dry-run. Tests use local D1 and synthetic model responses; separate full bundled Worker tests validate real session signatures and alternate-host guards. CI runs the same checks. `npm run deploy` additionally requires a clean checkout and an explicitly approved exact SHA.

Local-only browser preview:

```
LOCAL_CATALOG_SOURCE=/path/to/isolated/lcs/src/pages/research-magazine.ts node scripts/preview-workspace.mjs
```

Open `http://127.0.0.1:8799/research/workspace`. This script is outside the Worker entry, binds only loopback and uses disposable local D1, fixture users and fixture generation. It must never be deployed. Browser QA completed ETF import → candidate → draft → generate fixture → review → independent fixture reviewer approval → local fixture publication, plus filter URL and mobile overflow checks.

## Release gates and migration

- Live binding inspection found no SESSION_SECRET or FMP_API_KEY. Configure approved session/email auth; provision named approved team IDs. Do not infer membership from an email domain.
- Apply additive `src/db/migrations/006_research_workspace.sql` only after backup and migration-history validation; migration provisions no members. Existing 005 schema is required.
- Deploy LCS catalog endpoint before this Worker’s RESEARCH_CATALOG service binding. Keep public publication disabled initially.
- Confirm real sign-in, model generation, provider source/license, retries, preview isolation and existing Research Desk/stock-pitch flows in authorized staging.
- New published revisions currently join the workspace catalog, not the editorial homepage. `/all` remains an independent legacy collection. These are unfinished cross-repo migration tasks, not a claim of one completed universal registry.
- Rollback to prior observed stock-pitch version `9c0896d4-f12b-45f7-9a6f-60f2d4adf846` only after schema/security review. Keep additive tables and audit events; do not delete drafts or publish fixtures. Prior version lacks the new hardening, so prefer a safe forward fix.

Full ownership and migration map is in the companion LCS PR’s `docs/research-workspace-release.md`. Legacy production owns routes missing from its default branch, and must not be deployed from that branch until source reconciliation. Existing dependency audit issues remain outside this bounded implementation.
