-- =============================================================
-- Migration 007: Create wards table
-- Owner: Partner B
-- Description: Administrative wards linked to authorities
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS wards (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  code            VARCHAR(50) UNIQUE,                    -- official ward code e.g. "NRB-001"
  county          VARCHAR(100) NOT NULL,
  constituency    VARCHAR(100),
  authority_id    INT REFERENCES authorities(id) ON DELETE SET NULL,
  latitude        NUMERIC(9,6),                          -- centroid for map pins
  longitude       NUMERIC(9,6),
  population      INT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wards_county       ON wards (county);
CREATE INDEX idx_wards_authority_id ON wards (authority_id);

CREATE TRIGGER trg_wards_updated_at
  BEFORE UPDATE ON wards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  wards              IS 'Administrative ward units used for geographic scoping of issues';
COMMENT ON COLUMN wards.code        IS 'Official government ward code for external reference';
COMMENT ON COLUMN wards.authority_id IS 'The primary authority responsible for this ward';
COMMENT ON COLUMN wards.latitude    IS 'Ward centroid latitude for map visualisation';

COMMIT;
