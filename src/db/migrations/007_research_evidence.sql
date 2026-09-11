-- Additive private evidence store. No existing research record is modified.
CREATE TABLE research_source_objects (checksum TEXT PRIMARY KEY, original BLOB NOT NULL, byte_length INTEGER NOT NULL CHECK(byte_length>0 AND byte_length<=262144), created_at TEXT NOT NULL);
CREATE TABLE research_sources (source_id TEXT PRIMARY KEY, checksum TEXT NOT NULL REFERENCES research_source_objects(checksum), metadata_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE research_package_snapshots (snapshot_id TEXT PRIMARY KEY, package_id TEXT NOT NULL, revision_id TEXT NOT NULL REFERENCES research_revisions(id), workspace_version INTEGER NOT NULL, body_checksum TEXT NOT NULL, package_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(revision_id,workspace_version));
CREATE INDEX research_source_checksum ON research_sources(checksum);
CREATE INDEX research_package_revision ON research_package_snapshots(revision_id,workspace_version);
CREATE TRIGGER research_source_object_no_update BEFORE UPDATE ON research_source_objects BEGIN SELECT RAISE(ABORT,'Immutable original'); END;
CREATE TRIGGER research_source_object_no_delete BEFORE DELETE ON research_source_objects BEGIN SELECT RAISE(ABORT,'Immutable original'); END;
CREATE TRIGGER research_source_no_update BEFORE UPDATE ON research_sources BEGIN SELECT RAISE(ABORT,'Immutable source'); END;
CREATE TRIGGER research_source_no_delete BEFORE DELETE ON research_sources BEGIN SELECT RAISE(ABORT,'Immutable source'); END;
CREATE TRIGGER research_package_no_update BEFORE UPDATE ON research_package_snapshots BEGIN SELECT RAISE(ABORT,'Immutable package snapshot'); END;
CREATE TRIGGER research_package_no_delete BEFORE DELETE ON research_package_snapshots BEGIN SELECT RAISE(ABORT,'Immutable package snapshot'); END;
