# Stable security identity registry

Migration 010 is additive. It creates explicit company/security IDs, company regulator references, dated ticker aliases and identity audit events. Existing research revisions receive `security_id=NULL` and `identity_status='unresolved'`; legacy ticker-derived IDs are not guessed or rewritten.

`resolveResearchIdentity(db, {ticker, exchange?, securityId?, asOf})` requires an ISO calendar date and returns `resolved` with exactly one identity, `ambiguous` with candidate identities, or `unresolved`. A ticker never becomes an identity. A supplied security ID must still match the alias/date. Exchanges and tickers normalize to uppercase. Alias ranges include both endpoint dates; null boundaries are explicitly open-ended. One ticker on two exchanges is ambiguous unless the caller disambiguates. Overlapping same-exchange aliases are rejected transactionally, including overlapping aliases on the same security.

The `identities` subrouter should mount at `/api/identities` beneath the Research Desk. It independently checks team membership and same-origin writes:

- `POST /register`: `{company,security}` using the canonical package company/security shapes. IDs must be supplied by an analyst. Returns security and alias IDs; classification is always `analyst_supplied`, never automatically verified. Existing security IDs cannot be overwritten. Duplicate regulator references cannot point to another company.
- `POST /rename`: `{alias_id,valid_to,replacement:{ticker,valid_from,valid_to},reason}`. Closes an open alias and adds a later alias against the same security, with before/after audit. A conflict rolls back all writes; the prior security identity survives.
- `GET /resolve?ticker=...&asOf=YYYY-MM-DD&exchange=...&securityId=...`: returns the resolver result with private/no-store headers.

Tests use synthetic names/identifiers. They verify authentication, market ambiguity, same-market collision rollback, invalid currencies, historical date resolution, audited renames and preservation of legacy unresolved rows.

Draft intake, browser controls and package-attachment checks must consume this resolver and the revision columns; those integrations are separate from the registry module. Registration confirms structural consistency only, not that the supplied security identifiers match a regulator or exchange source.
