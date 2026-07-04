-- =============================================================
-- Migration 018: Resident one-time report soft delete support
-- Description: Adds nullable soft-delete metadata for resident-owned
--              report removal, preserving historical references.
-- =============================================================

BEGIN;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS resident_deleted_at TIMESTAMPTZ;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS resident_deleted_by INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_reports_resident_deleted_by'
      AND conrelid = 'reports'::regclass
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT fk_reports_resident_deleted_by
      FOREIGN KEY (resident_deleted_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_resident_deleted_at
  ON reports(resident_deleted_at);

CREATE INDEX IF NOT EXISTS idx_reports_user_visible_created_at
  ON reports(user_id, created_at DESC)
  WHERE resident_deleted_at IS NULL;

COMMIT;
