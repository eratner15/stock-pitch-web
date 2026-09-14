# Integration checkpoint — 2026-09-14

## Implemented
- LCS integration includes current main through 8fcca368 (including COO and MTN) plus the existing research workspace patch.
- One service-backed catalog joins 77 editorial entries, explicitly public legacy pitches, and reviewed/published workspace revisions. The homepage, /signal, /all, and Research Desk use this projection. No provider calls back into the aggregator.
- Public document links use the research hostname on all workspace aliases. Publication and withdrawal refresh the catalog; public article lookups and catalog responses are no-store.
- Unavailable or unmigrated providers fail closed with visible collection status. Dynamic titles and summaries are escaped.
- Recovered legacy LCV, dinner and COF source from feature/cof-earnings-preview e6ab0bc, retaining safety guards. This is a source candidate, NOT a verified copy of the deployed Worker. /spread requires an explicitly public pitch before using LCV enrichment.
- Renamed the unapplied visibility migration to 0008_publication_visibility.sql to follow the recovered LCV migrations. Confirm actual D1 migration history before applying it.

## Verified locally
- LCS: focused TypeScript check, 77-tile catalog validation, seven tests, Worker build dry run.
- Workspace: full TypeScript check, seven tests, Worker build dry run.
- Legacy: four D1-backed tests and Worker build dry run.
- Three actual Worker bundles run together in Miniflare with service bindings and separate disposable D1 databases. Signed fixture sessions create a draft, independently approve it, publish it, verify identical catalog IDs in Research Desk, verify visibility on homepage /signal and /all, then withdraw it and verify immediate removal and article 404.
- Anonymous workspace requests fail; private legacy rows never join the catalog.
- Cross-repository command: with sibling checkouts named lcs-portfolio-intel, stock-pitch-web, levincap-research and npm ci in each, run npm run test:integration from stock-pitch-web.
- Synthetic users and evidence only. No production records were changed or migrations applied.

## Remote staging is NOT complete
This runtime has GitHub connector access but no Cloudflare account credentials. Local signed-session tests do not prove live OAuth. Existing generation tests use explicit synthetic responses, not live model calls. Live ETF provider calls are not verified.

Before remote staging can pass:
1. Restore Cloudflare access; inspect current Worker versions, routes, bindings, secrets presence and D1 migration history. Compare the exact deployed legacy source with e6ab0bc plus this patch.
2. Create isolated staging Workers/databases and identity/provider configuration; no production D1/KV/R2 bindings, production routes, crons, or bundled confidential client data in the staging deployment. Supply a dedicated staging origin/router so canonical links cannot send test navigation to production.
3. Apply reviewed migrations only to staging, provision analyst and independent reviewer membership, and wire all three service bindings.
4. Exercise actual sign-in, ETF retrieval, real generation and retry, editing, independent review, publication, withdrawal, and alternate-host denial. Record deployment versions and screenshots using nonconfidential test evidence.
5. Audit recovered LCV/dinner reads, APIs and exports against the intended publication policy; the pitch/feature tests are not a complete LCV authorization audit.
6. Keep production publication disabled and existing release gates in place until the complete staging evidence is reviewed. Production approval is a separate final step.

Earlier release documents describe the September 4/5 baseline; this checkpoint supersedes their catalog-integration and local test counts. It does not supersede unresolved access, source-reconciliation or live-provider requirements.
