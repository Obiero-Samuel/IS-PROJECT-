-- =============================================================
-- Migration 006: Create authorities table
-- Owner: Partner B
-- Description: Civic/government bodies that handle escalations
-- =============================================================

BEGIN;

CREATE TYPE authority_type AS ENUM ('municipal', 'county', 'national', 'ngo');

CREATE TABLE IF NOT EXISTS authorities (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  type             authority_type NOT NULL DEFAULT 'municipal',
  jurisdiction     VARCHAR(255),                        -- area of coverage (e.g. "Nairobi County")
  contact_email    VARCHAR(255),
  phone            VARCHAR(30),
  website          VARCHAR(255),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by type and jurisdiction
CREATE INDEX idx_authorities_type        ON authorities (type);
CREATE INDEX idx_authorities_jurisdiction ON authorities (jurisdiction);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_authorities_updated_at
  BEFORE UPDATE ON authorities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  authorities                IS 'Civic and government bodies responsible for handling escalated issues';
COMMENT ON COLUMN authorities.type          IS 'Classification of the authority: municipal, county, national, or ngo';
COMMENT ON COLUMN authorities.jurisdiction  IS 'Geographic or administrative area the authority covers';
COMMENT ON COLUMN authorities.is_active     IS 'Soft-delete flag; FALSE hides the authority from public listings';

COMMIT;
