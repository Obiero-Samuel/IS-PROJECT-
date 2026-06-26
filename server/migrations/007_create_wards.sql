-- =============================================================
-- Migration 007: Create wards table
-- Owner: Partner B
-- Description: Administrative wards linked to authorities
-- =============================================================

CREATE TABLE IF NOT EXISTS wards (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50) UNIQUE,
  county          VARCHAR(100) NOT NULL,
  constituency    VARCHAR(100),
  authority_id    INT REFERENCES authorities(id) ON DELETE SET NULL,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  population      INT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wards_county       ON wards (county);
CREATE INDEX IF NOT EXISTS idx_wards_authority_id ON wards (authority_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wards_updated_at'
  ) THEN
    CREATE TRIGGER trg_wards_updated_at
      BEFORE UPDATE ON wards
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE  wards               IS 'Administrative ward units for geographic scoping of issues';
COMMENT ON COLUMN wards.code          IS 'Official government ward code (e.g. NRB-001)';
COMMENT ON COLUMN wards.authority_id  IS 'Primary authority responsible for this ward';
COMMENT ON COLUMN wards.latitude      IS 'Ward centroid latitude for map visualisation';
