-- =============================================================
-- Migration 016: Officer/Admin dashboard contract
-- Description: Adds schema fields needed for officer scoping,
--              account activity state, admin override controls,
--              configurable response deadlines, and report files.
-- =============================================================

BEGIN;

-- -----------------------------------------------------------------
-- users: officer mapping + account activity context
-- -----------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS authority_id INT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'authorities'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_users_authority_id'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_authority_id
      FOREIGN KEY (authority_id) REFERENCES authorities(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE users
SET is_active = TRUE
WHERE is_active IS NULL;

DO $$
DECLARE
  authority_total INT;
  only_authority_id INT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'authorities'
  ) THEN
    SELECT COUNT(*)::INT INTO authority_total FROM authorities;

    IF authority_total = 1 THEN
      SELECT id INTO only_authority_id
      FROM authorities
      ORDER BY id
      LIMIT 1;

      UPDATE users
      SET authority_id = only_authority_id
      WHERE role = 'authority'
        AND authority_id IS NULL;
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------
-- reports: admin override close metadata
-- -----------------------------------------------------------------
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS closed_by_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS admin_override_notes TEXT;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- -----------------------------------------------------------------
-- category_authority_map: escalation SLA per mapping
-- -----------------------------------------------------------------
ALTER TABLE IF EXISTS category_authority_map
  ADD COLUMN IF NOT EXISTS response_deadline_days INT NOT NULL DEFAULT 7;

-- -----------------------------------------------------------------
-- summary_reports: downloadable artifact metadata
-- -----------------------------------------------------------------
ALTER TABLE IF EXISTS summary_reports
  ADD COLUMN IF NOT EXISTS report_file_url TEXT;

ALTER TABLE IF EXISTS summary_reports
  ADD COLUMN IF NOT EXISTS report_file_type VARCHAR(30);

-- -----------------------------------------------------------------
-- Index coverage
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role_is_active ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_users_authority_id ON users(authority_id);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_status_created_at ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_closed_by_admin ON reports(closed_by_admin);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'category_authority_map'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_cam_authority_category
      ON category_authority_map(authority_id, category_id);

    CREATE INDEX IF NOT EXISTS idx_cam_response_deadline_days
      ON category_authority_map(response_deadline_days);
  END IF;
END $$;

COMMIT;
