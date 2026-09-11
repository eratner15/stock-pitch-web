# Research package and evidence API v1.0

`src/lib/research-package.ts` is the runtime Zod schema. `tests/fixtures/research-package.json` is a synthetic fixture, not investment research. It preserves company/security identity, dated ticker aliases, reporting and trading currency, fiscal periods, typed facts, raw values, assumptions, deterministic-model references, revision-bound artifacts and judgment evidence references. Unknown fields are explicit nulls; a missing amount is never normalized to zero.

Apply additive migration 007 only after 006 in a controlled release. It creates private immutable source objects, metadata and revision package snapshots with database update/delete prevention. This migration has been exercised locally, not remotely. Snapshot attachment verifies author, company, body checksum and optimistic version; a concurrent body edit prevents insertion. No existing records are rewritten.

Authenticated Research Desk routes, beneath the existing membership and same-origin middleware:

- `POST /research/workspace/api/evidence`: `{source: <sourceSchema>, original_text: "..."}`. Source checksum must match UTF-8 bytes. Only text originals up to 256 KiB are supported here. Identical documents share one immutable object; distinct metadata gets a new source ID. Null timestamps, unknown rights and unreadable quality remain explicit.
- `GET /research/workspace/api/evidence/:id`: exact source metadata.
- `GET /research/workspace/api/evidence/:id/original`: original bytes as a private download, never executable HTML.
- `POST /research/workspace/api/packages`: validated draft package. All source records must exactly match the immutable source ledger. A snapshot cannot confer approval or public visibility.
- `GET /research/workspace/api/packages/:revision`: latest immutable snapshot, including its workspace version. It can be older than the editable draft; consumers must compare versions.
- `POST /research/workspace/api/packages/:revision/verify`: `{claim: <factSchema>, evidence_fact_id: "..."}` compares metric, identity, fiscal period, scale, currency, segment, accounting basis, source locator, kind and signed normalized value against saved evidence. Response identifies the exact evidence revision/version and scope.

Legacy prose verification now assigns zero verified claims. A numerical substring appearing in a filing cannot raise confidence. The typed verifier can establish consistency with an analyst-supplied saved fact; it does not independently certify extraction accuracy. A raw-number search remains available only for warning diagnostics, not verification.

Validation covers ticker aliases across exchanges and dates, missing identity and references, invalid currencies/periods, revision mismatches, zero/null distinctions, million/billion conversions, signs, segment sums, same numbers from different years, duplicate original checksums, source immutability, unreadable/restricted rights, authorization, draft edits and typed verification through the mounted API. Full verify runs TypeScript, Worker/D1 tests and Wrangler dry-run.

Remaining integrations: automated EDGAR ingestion and page/table extraction, binary PDF/workbook originals in configured private R2 or equivalent storage, extraction review attestation, package attachment in the browser UI, and publication checks consuming these immutable snapshots. Until connected, these API foundations do not establish that every existing prose conclusion has typed evidence. Publication approval and stale-package rejection belong to the workflow gate.
