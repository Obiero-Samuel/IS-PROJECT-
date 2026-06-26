-- =============================================================
-- Seed 007: Seed wards
-- Owner: Partner B
-- =============================================================

INSERT INTO wards (name, code, county, constituency, authority_id, latitude, longitude, population, is_active) VALUES
  ('Westlands',           'NRB-001', 'Nairobi',  'Westlands',        1, -1.268200,  36.803900, 68000,  TRUE),
  ('Parklands',           'NRB-002', 'Nairobi',  'Westlands',        1, -1.262100,  36.819400, 54000,  TRUE),
  ('Lavington',           'NRB-003', 'Nairobi',  'Dagoretti North',  1, -1.285300,  36.778100, 47000,  TRUE),
  ('Karen',               'NRB-004', 'Nairobi',  'Langata',          1, -1.330500,  36.714700, 39000,  TRUE),
  ('Embakasi Village',    'NRB-005', 'Nairobi',  'Embakasi East',    1, -1.318200,  36.896600, 82000,  TRUE),
  ('Mihango',             'NRB-006', 'Nairobi',  'Embakasi East',    10,-1.300400,  36.924800, 95000,  TRUE),
  ('Kilimani',            'NRB-007', 'Nairobi',  'Dagoretti North',  1, -1.291900,  36.784800, 61000,  TRUE),
  ('Ganjoni',             'MSA-001', 'Mombasa',  'Mvita',            2, -4.063700,  39.665900, 32000,  TRUE),
  ('Mvita',               'MSA-002', 'Mombasa',  'Mvita',            2, -4.056100,  39.658700, 45000,  TRUE),
  ('Kondele',             'KSM-001', 'Kisumu',   'Kisumu Central',   3, -0.100100,  34.754100, 56000,  TRUE),
  ('Kolwa Central',       'KSM-002', 'Kisumu',   'Kisumu East',      3, -0.068700,  34.799000, 48000,  TRUE),
  ('Highrise',            'NRB-008', 'Nairobi',  'Mathare',          1, -1.256600,  36.852100, 73000,  TRUE)
ON CONFLICT (code) DO NOTHING;
