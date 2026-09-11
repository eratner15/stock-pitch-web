# SAFE-02 verification

Missing, blank and malformed rating metadata remains `Unrated`. Metric metadata preserves real zero, uses an em dash for absent values, and keeps invalid source labels `Source unresolved`. Accepted source label syntax is an explicit supported bracket tag or HTTPS URL; it is not proof the claim is supported.

All three legacy portal confidence ingestion paths use the same rating normalizer. Generation checks minimum provenance before rendering and persisting public KV pages. It rejects an unrated result, missing metric evidence, or a 10-K/10-Q label without a retrieved corresponding filing. Failed generation follows the existing job failure handler and does not replace previously stored pages.

Validation: `npm run verify` passed TypeScript, 10 tests (including three provenance/price regression cases), and Wrangler dry-run. `git diff --check` passed. No remote write or deployment occurred.

Limits: the full AI generation workflow was not invoked with live paid providers. These checks are minimum input validation, not independent factual verification, review approval, or complete publication policy. Existing published KV data is unchanged. The legacy direction and price-target extraction heuristics remain separate DATA/MODEL work; a source label does not establish a source locator, period, unit, or claim-level match.
