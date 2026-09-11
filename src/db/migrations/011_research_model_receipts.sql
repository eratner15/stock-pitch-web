-- Server-issued arithmetic receipts. Existing package assertions remain immutable.
CREATE TABLE research_model_receipts (receipt_id TEXT PRIMARY KEY, snapshot_id TEXT NOT NULL REFERENCES research_package_snapshots(snapshot_id), model_id TEXT NOT NULL, engine_version TEXT NOT NULL, package_checksum TEXT NOT NULL, receipt_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(snapshot_id,model_id,engine_version));
CREATE TRIGGER research_model_receipt_no_update BEFORE UPDATE ON research_model_receipts BEGIN SELECT RAISE(ABORT,'Immutable model receipt'); END;
CREATE TRIGGER research_model_receipt_no_delete BEFORE DELETE ON research_model_receipts BEGIN SELECT RAISE(ABORT,'Immutable model receipt'); END;
