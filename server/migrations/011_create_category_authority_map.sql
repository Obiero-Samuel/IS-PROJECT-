-- =============================================================
-- Migration 011: Create category_authority_map table
-- Owner: Partner B
-- Description: Join table to route categories to authorities
-- =============================================================

CREATE TABLE IF NOT EXISTS category_authority_map (
  category_id  INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  authority_id INT NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category_id, authority_id)
);

COMMENT ON TABLE category_authority_map IS 'Maps issue categories to the authorities responsible for them';
