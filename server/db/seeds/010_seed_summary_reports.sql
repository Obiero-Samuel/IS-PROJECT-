-- =============================================================
-- Seed 010: Seed summary_reports
-- Owner: Partner B
-- NOTE: Requires authorities (ids 1–10) and wards (ids 1–12) to exist.
-- =============================================================

INSERT INTO summary_reports (
  authority_id, ward_id, report_period, period_start, period_end,
  total_issues, open_issues, resolved_issues, pending_issues, escalated_issues,
  avg_resolution_days, top_category, report_notes, generated_at
) VALUES
  -- Nairobi City County — monthly reports per ward
  (1,  1,  'monthly', '2026-04-01', '2026-04-30',  42, 8,  28, 4,  2,  14.5, 'Roads & Potholes',   'High pothole activity in Apr following rains.',          '2026-05-01 00:00:00+03'),
  (1,  2,  'monthly', '2026-04-01', '2026-04-30',  31, 5,  22, 3,  1,  11.2, 'Waste Management',   'Illegal dumping spike near market.',                     '2026-05-01 00:00:00+03'),
  (1,  3,  'monthly', '2026-04-01', '2026-04-30',  19, 3,  14, 2,  0,   9.8, 'Water Supply',       'Burst mains accounted for 60% of issues.',               '2026-05-01 00:00:00+03'),
  (1,  1,  'monthly', '2026-05-01', '2026-05-31',  38, 6,  27, 4,  1,  13.1, 'Roads & Potholes',   'KENHA resolved 3 major potholes mid-month.',             '2026-06-01 00:00:00+03'),
  (1,  NULL,'monthly', '2026-05-01', '2026-05-31', 215, 44, 148, 18, 5,  12.4, 'Roads & Potholes',  'County-wide summary. Roads top category 3 months running.','2026-06-01 00:00:00+03'),

  -- Mombasa County — quarterly
  (2,  8,  'quarterly','2026-01-01', '2026-03-31',  88, 12,  61, 9,  6,  18.7, 'Sanitation',         'Sewage overflow issues dominated Q1.',                   '2026-04-01 00:00:00+03'),
  (2,  9,  'quarterly','2026-01-01', '2026-03-31',  74, 9,   55, 7,  3,  16.2, 'Roads & Potholes',   'Coastal road degradation from rainfall.',                '2026-04-01 00:00:00+03'),

  -- Kisumu County — quarterly
  (3, 10,  'quarterly','2026-01-01', '2026-03-31',  56, 8,   40, 6,  2,  15.0, 'Water Supply',       'Kondele water supply disruptions Q1.',                   '2026-04-01 00:00:00+03'),
  (3, 11,  'quarterly','2026-01-01', '2026-03-31',  48, 7,   35, 5,  1,  13.5, 'Street Lighting',    'Street light outages main complaint.',                   '2026-04-01 00:00:00+03'),

  -- KENHA — annual national
  (4, NULL, 'annual',  '2025-01-01', '2025-12-31', 1240, 110, 980, 120, 30, 22.3, 'Roads & Potholes', 'National roads summary 2025. 79% resolution rate.',     '2026-01-15 00:00:00+03'),

  -- KPLC — annual national
  (5, NULL, 'annual',  '2025-01-01', '2025-12-31',  890, 95,  700, 85, 10,  9.8, 'Power Outages',    'Power outage issues. 79% resolved within 10 days avg.', '2026-01-15 00:00:00+03')
ON CONFLICT ON CONSTRAINT uq_summary_reports DO NOTHING;
