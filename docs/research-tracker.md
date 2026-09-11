# Persistent thesis and catalyst tracker

Migration 009 adds immutable tracker identities/forecast snapshots and append-only outcome records. Forecasts point at an immutable research package snapshot, so prior facts, assumptions and model references remain available. The tracker does not rewrite historical probabilities. Data corrections and judgment changes have distinct event types and require an explanation in `outcome`.

Mount exported `tracker` from `src/routes/research-tracker.ts` at `/api/tracker` beneath the Research Desk. The subrouter also verifies team membership and same-origin writes itself.

- `POST /import` with `{package_snapshot_id}` imports the package's thesis pillars and catalysts. IDs are stable within package/kind/item identity. Importing the same snapshot is idempotent. Claim owner/check date remain null because the canonical pillar schema does not yet supply them; catalyst values preserve confirmed/estimated/unresolved status.
- `POST /events` takes `snapshot_id`, `previous_event_id` (null for first event), `event_type`, `outcome`, `next_check`, `date_kind`, `owner`, `source_ids`, and `superseding_snapshot_id`. Every field is explicit. Dates are ISO calendar dates or null. An outcome's evidence must belong to its referenced package; new evidence requires a new immutable package snapshot. Supersession must reference another tracker snapshot in the same package. A correction appends to history instead of modifying the original record.
- `GET /package/:id` returns current forecast snapshots, all historical outcomes, current state and overdue checks. New forecast snapshots do not inherit resolved state from an older forecast. Source package creation order determines current snapshots rather than import order.
- `GET /package/:id/export.csv` exports the current view with revision/snapshot IDs and history counts. Potential spreadsheet-formula text is escaped. The JSON endpoint retains complete audit history.

Only the package author or a reviewer can import; only the assigned owner (author when unresolved) or a reviewer can append outcomes. Optimistic previous-event IDs prevent lost updates. All responses are private/no-store. SQL binds values and the migration blocks update/delete operations on identity, snapshot and event tables.

Tests use synthetic package snapshots and local D1. They cover authorization, same-origin enforcement, repeated imports, estimated/overdue dates, null fields, safe CSV, resolution, correction, supersession, conflict rejection and immutable prior forecasts.

The browser tracker view and calibration-ledger importer are not added by this module. The local `tracker.json` renderer remains a package snapshot until a caller attaches the history API output. Migration and route mounting are required before deployment.
