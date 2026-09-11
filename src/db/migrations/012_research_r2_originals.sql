-- Optional large-original storage. Existing D1 BLOB rows and foreign keys are unchanged.
CREATE TABLE research_r2_objects (checksum TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, byte_length INTEGER NOT NULL CHECK(byte_length>262144 AND byte_length<=20971520), created_at TEXT NOT NULL);
CREATE TABLE research_r2_sources (source_id TEXT PRIMARY KEY, checksum TEXT NOT NULL REFERENCES research_r2_objects(checksum), metadata_json TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TRIGGER research_r2_source_unique BEFORE INSERT ON research_r2_sources WHEN EXISTS(SELECT 1 FROM research_sources WHERE source_id=NEW.source_id) BEGIN SELECT RAISE(ABORT,'Source ID already stored in D1'); END;
CREATE TRIGGER research_d1_source_unique BEFORE INSERT ON research_sources WHEN EXISTS(SELECT 1 FROM research_r2_sources WHERE source_id=NEW.source_id) BEGIN SELECT RAISE(ABORT,'Source ID already stored in R2'); END;
CREATE TRIGGER research_r2_object_no_update BEFORE UPDATE ON research_r2_objects BEGIN SELECT RAISE(ABORT,'Immutable R2 object metadata'); END;
CREATE TRIGGER research_r2_object_no_delete BEFORE DELETE ON research_r2_objects BEGIN SELECT RAISE(ABORT,'Immutable R2 object metadata'); END;
CREATE TRIGGER research_r2_source_no_update BEFORE UPDATE ON research_r2_sources BEGIN SELECT RAISE(ABORT,'Immutable R2 source'); END;
CREATE TRIGGER research_r2_source_no_delete BEFORE DELETE ON research_r2_sources BEGIN SELECT RAISE(ABORT,'Immutable R2 source'); END;
