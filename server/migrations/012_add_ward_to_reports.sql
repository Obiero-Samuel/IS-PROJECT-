-- =============================================================
-- Migration 012: Add ward_id to reports
-- Owner: Partner B
-- Description: Allows reports to be geo-scoped to specific wards
-- =============================================================

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS ward_id INT REFERENCES wards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_ward_id ON reports(ward_id);

COMMENT ON COLUMN reports.ward_id IS 'The ward where the issue was reported';
