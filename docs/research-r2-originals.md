# Optional private R2 evidence originals

The existing `POST /research/workspace/api/evidence/file` multipart endpoint now supports PDF/XLSX originals above 256 KiB when `EVIDENCE_ORIGINALS` is bound to a private R2 bucket. Maximum original size is 20 MiB. With no binding, the existing 256 KiB D1 behavior remains. No bucket or binding was created by this change.

Prerequisites for a controlled release:

1. Apply additive migration `012_research_r2_originals.sql` after migration 007. It keeps the old BLOB table and foreign keys unchanged, and adds immutable metadata tables for large objects. Cross-store triggers prevent a source ID from acquiring two different records.
2. Configure an existing or newly provisioned private R2 bucket under the binding name `EVIDENCE_ORIGINALS`. Do not enable public access or attach a public bucket domain. This deployment setting is deliberately not present in the production Wrangler configuration yet.
3. Check `/research/workspace/api/evidence-capabilities` as a signed-in team member. It distinguishes an absent binding from a present binding, reports limits and the required migration; binding presence alone is not proof of bucket or migration readiness.

The request reader consumes chunks and cancels on the enforced byte limit, regardless of a missing or false Content-Length. Multipart overhead is separately bounded to 40 KiB; metadata is limited to 32 KiB. After the bounded read, bytes are buffered for SHA-256 and container validation. This is bounded streaming ingestion, not zero-copy forwarding. ZIP structural and expansion limits still apply; no formulas, macros or document scripts execute.

Objects use `research-originals/sha256/<checksum>` and conditional creation (`If-None-Match: *` semantics). Duplicate uploads preserve immutable source metadata and deduplicate the object. A retry encountering an existing object reads and verifies its actual bytes, not just custom metadata or ETag. No public URLs are returned. The source ledger stores only metadata/object references in D1 for large originals.

`GET /research/workspace/api/evidence/:id/original` serves either storage type through the existing signed-in team gate. It rechecks the original checksum, returns an attachment with `application/octet-stream` and `private, no-store`, and fails closed when an R2 object is missing, altered or unavailable. Source rights remain on the immutable source record and continue through the existing publication rights gate; public rights do not create public original-download access.

The text and workbook-extraction endpoints can use R2 if their bounded JSON payload exceeds 256 KiB. Their existing 1 MiB request cap remains, separate from the 20 MiB binary-original cap.

An R2 write followed by a failed D1 transaction can leave an unreferenced private content-addressed object. The code does not delete it automatically because another source may already reference the same bytes. Operational retention/orphan review should compare immutable metadata before deletion. No automatic retention policy is configured here.

Validation: local Miniflare R2 and D1 tests verify exact bytes, cross-store metadata, deduplication, immutable IDs, checksum rejection, object tamper rejection, unavailable binding, role/sign-in gates, private headers and streaming cancellation above the limit. Full verification passed TypeScript, 58 tests and Wrangler dry-run. No live R2 writes, migration application or deployment occurred.
