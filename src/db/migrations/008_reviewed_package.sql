-- Approval points at immutable evidence content, independently from status version changes.
ALTER TABLE research_revisions ADD COLUMN reviewed_snapshot_id TEXT REFERENCES research_package_snapshots(snapshot_id);
