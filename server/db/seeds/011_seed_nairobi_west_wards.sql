-- =============================================================
-- Seed 011: Seed Nairobi West-focused wards
-- Purpose: Curated Nairobi west-side wards for auth register/login dropdowns
-- Notes:
--   - Uses NBIW-* codes so focused API queries can target this curated set.
--   - authority_id is nullable; left NULL to avoid seed-order FK dependency.
-- =============================================================

BEGIN;

INSERT INTO wards (name, code, county, constituency, authority_id, is_active) VALUES
  -- Westlands (5)
  ('Kitisuru',                      'NBIW-001', 'Nairobi', 'Westlands',       NULL, TRUE),
  ('Parklands/Highridge',           'NBIW-002', 'Nairobi', 'Westlands',       NULL, TRUE),
  ('Karura',                        'NBIW-003', 'Nairobi', 'Westlands',       NULL, TRUE),
  ('Kangemi',                       'NBIW-004', 'Nairobi', 'Westlands',       NULL, TRUE),
  ('Mountain View',                 'NBIW-005', 'Nairobi', 'Westlands',       NULL, TRUE),

  -- Dagoretti North (5)
  ('Kilimani',                      'NBIW-006', 'Nairobi', 'Dagoretti North', NULL, TRUE),
  ('Kawangware',                    'NBIW-007', 'Nairobi', 'Dagoretti North', NULL, TRUE),
  ('Gatina',                        'NBIW-008', 'Nairobi', 'Dagoretti North', NULL, TRUE),
  ('Kileleshwa',                    'NBIW-009', 'Nairobi', 'Dagoretti North', NULL, TRUE),
  ('Kabiro',                        'NBIW-010', 'Nairobi', 'Dagoretti North', NULL, TRUE),

  -- Dagoretti South (5)
  ('Mutu-ini',                      'NBIW-011', 'Nairobi', 'Dagoretti South', NULL, TRUE),
  ('Ngando',                        'NBIW-012', 'Nairobi', 'Dagoretti South', NULL, TRUE),
  ('Riruta',                        'NBIW-013', 'Nairobi', 'Dagoretti South', NULL, TRUE),
  ('Uthiru/Ruthimitu',              'NBIW-014', 'Nairobi', 'Dagoretti South', NULL, TRUE),
  ('Waithaka',                      'NBIW-015', 'Nairobi', 'Dagoretti South', NULL, TRUE),

  -- Lang'ata (5)
  ('Karen',                         'NBIW-016', 'Nairobi', 'Lang''ata',       NULL, TRUE),
  ('Nairobi West',                  'NBIW-017', 'Nairobi', 'Lang''ata',       NULL, TRUE),
  ('Mugumoini',                     'NBIW-018', 'Nairobi', 'Lang''ata',       NULL, TRUE),
  ('South C',                       'NBIW-019', 'Nairobi', 'Lang''ata',       NULL, TRUE),
  ('Nyayo Highrise',                'NBIW-020', 'Nairobi', 'Lang''ata',       NULL, TRUE),

  -- Kibra (5)
  ('Laini Saba',                    'NBIW-021', 'Nairobi', 'Kibra',           NULL, TRUE),
  ('Lindi',                         'NBIW-022', 'Nairobi', 'Kibra',           NULL, TRUE),
  ('Makina',                        'NBIW-023', 'Nairobi', 'Kibra',           NULL, TRUE),
  ('Woodley/Kenyatta Golf Course',  'NBIW-024', 'Nairobi', 'Kibra',           NULL, TRUE),
  ('Sarang''ombe',                  'NBIW-025', 'Nairobi', 'Kibra',           NULL, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  county = EXCLUDED.county,
  constituency = EXCLUDED.constituency,
  authority_id = EXCLUDED.authority_id,
  is_active = EXCLUDED.is_active;

COMMIT;
