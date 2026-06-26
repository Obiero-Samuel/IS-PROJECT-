-- =============================================================
-- Seed 006: Seed authorities
-- Owner: Partner B
-- =============================================================

INSERT INTO authorities (name, type, jurisdiction, contact_email, phone, website, is_active) VALUES
  ('Nairobi City County Government',    'county',    'Nairobi County',        'info@nairobi.go.ke',          '+254 20 2229000', 'https://nairobi.go.ke',          TRUE),
  ('Mombasa County Government',         'county',    'Mombasa County',        'info@mombasa.go.ke',          '+254 41 2311291', 'https://mombasa.go.ke',          TRUE),
  ('Kisumu County Government',          'county',    'Kisumu County',         'info@kisumu.go.ke',           '+254 57 2021025', 'https://kisumu.go.ke',           TRUE),
  ('Kenya National Highways Authority', 'national',  'Republic of Kenya',     'info@kenha.co.ke',            '+254 20 8013842', 'https://kenha.co.ke',            TRUE),
  ('Kenya Power & Lighting Company',    'national',  'Republic of Kenya',     'customercare@kplc.co.ke',     '+254 20 3201000', 'https://kplc.co.ke',             TRUE),
  ('Nairobi Water & Sewerage Company',  'municipal', 'Nairobi County',        'customercare@nairobiwater.co.ke', '+254 20 3580000', 'https://nairobiwater.co.ke', TRUE),
  ('Kenya Revenue Authority',           'national',  'Republic of Kenya',     'callcentre@kra.go.ke',        '+254 20 4999999', 'https://kra.go.ke',              TRUE),
  ('Habitat for Humanity Kenya',        'ngo',       'Multiple Counties',     'info@habitatkenya.org',       '+254 20 3870508', 'https://habitatkenya.org',       TRUE),
  ('Westlands Sub-County Office',       'municipal', 'Westlands, Nairobi',   'westlands@nairobi.go.ke',     '+254 20 4449950', NULL,                             TRUE),
  ('Embakasi East Sub-County Office',   'municipal', 'Embakasi East, Nairobi','embakasi.east@nairobi.go.ke', '+254 20 5579280', NULL,                             TRUE)
ON CONFLICT DO NOTHING;
