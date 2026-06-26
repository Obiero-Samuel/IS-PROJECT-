-- =============================================================
-- Migration 006: Create authorities table
-- Owner: Partner B
-- Description: Civic/government bodies that handle escalations
-- =============================================================

-- Auto-update trigger function (shared across B's tables)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE IF NOT EXISTS authority_type AS ENUM ('municipal', 'county', 'national', 'ngo');

CREATE TABLE IF NOT EXISTS authorities (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  type             authority_type NOT NULL DEFAULT 'municipal',
  jurisdiction     VARCHAR(255),
  contact_email    VARCHAR(255),
  phone            VARCHAR(30),
  website          VARCHAR(255),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authorities_type         ON authorities (type);
CREATE INDEX IF NOT EXISTS idx_authorities_jurisdiction  ON authorities (jurisdiction);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_authorities_updated_at'
  ) THEN
    CREATE TRIGGER trg_authorities_updated_at
      BEFORE UPDATE ON authorities
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE  authorities               IS 'Civic and government bodies responsible for handling escalated issues';
COMMENT ON COLUMN authorities.type         IS 'Classification: municipal, county, national, or ngo';
COMMENT ON COLUMN authorities.jurisdiction IS 'Geographic or administrative area the authority covers';
COMMENT ON COLUMN authorities.is_active    IS 'Soft-delete flag; FALSE hides the authority from public listings';
