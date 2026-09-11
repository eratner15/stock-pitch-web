# Read-only provider adapters: DATA-04 / DATA-07 candidate

`src/lib/research-providers.ts` exposes providerCapabilities, discoverFilings(CIK),
discoverProfile(symbol), discoverMacro(seriesId), discoverLevyNotes(symbol), and
freshness. Every discovery returns typed availability, retrieval/as-of timestamps,
freshness, sanitized source URI, rights, response checksum and projected data.
Configured credentials are explicitly not verified entitlement. Only an actual
successful request reports that operation available; it does not certify the
whole subscription. Freshness requires a caller-supplied maximum age and source
as-of date; missing/future/invalid dates remain unknown. Currency/share-class/ADR
mapping must still be verified before modeling; profile lookup does not resolve it.

Endpoint patterns are recovered from Alpha source commit
19651dec2bddb73b62d3a720d5ff8fe042aa5764 (FMP stable/profile, SEC submissions,
FRED observations). They use fixed provider origins, identifier validation,
GET only, no redirects, a 10-second abort covering body reads, bounded JSON,
no reflected provider error bodies, no credential-bearing source URLs, and no
logs. This prevents caller-supplied URLs from turning discovery into an arbitrary
network fetch. Raw provider JSON is not automatically accepted as model facts.

Levy source commit c2f014f8f0eee282e55073a85958ef5188bddcec exposes authenticated
GET /api/notes with exact ticker filter and bounded limit. It accepts Basic auth
using LEVY_PASSWORD; optional LEVY service binding can carry the same request.
The adapter projects note ID, firm, type and receipt time only. Subjects, bodies,
thesis summaries and web links are deliberately absent. Notes remain internal,
with note-ID locators; originals require authenticated source review. This is
metadata discovery, not original-email ingestion or licensed-publication rights.

Observed 2026-09-11: anonymous GET https://levy.levincap.com/api/notes returned401.
No authenticated live corpus was fetched. SEC contact identity, FMP/FRED keys,
and Levy password/binding are not provisioned by this change. No live paid
provider success or entitlement is claimed. API calls in tests use synthetic
responses; tests prove foreign20-F records, no invented zero for missing FRED
values, secret redaction, auth unavailability, fixed URLs and metadata filtering.

Root integration must mount these functions only inside existing signed-session,
research-membership and no-store middleware. Do not add public Levy endpoints.
No original Levy/Alpha files, email-sending paths, trade paths or deployments were
changed. Remaining DATA work includes live configured-provider validation,
original-source capture, full financial statement/consensus adapters and formal
foreign security mapping. These task gates are not complete solely from helpers.

Validation: `node --test tests/research-providers.test.mjs` (5 passing),
`npx tsc --noEmit` (passing).
