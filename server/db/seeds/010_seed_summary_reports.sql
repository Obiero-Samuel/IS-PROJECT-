-- =============================================================
-- Seed 010: Seed summary_reports
-- Owner: Partner B
-- NOTE: Resolves authority/ward IDs dynamically by authority name and ward code.
--       This avoids hardcoded FK assumptions across environments.
-- =============================================================

WITH seed_rows AS (
  SELECT *
  FROM (
    VALUES
      -- Nairobi City County — monthly reports per ward
      ('Nairobi City County Government', 'NRB-001', 'monthly'::report_period, DATE '2026-04-01', DATE '2026-04-30',  42,  8,  28,  4,  2, 14.5::NUMERIC(6,2), 'Roads & Potholes', 'High pothole activity in Apr following rains.',             TIMESTAMPTZ '2026-05-01 00:00:00+03'),
      ('Nairobi City County Government', 'NRB-002', 'monthly'::report_period, DATE '2026-04-01', DATE '2026-04-30',  31,  5,  22,  3,  1, 11.2::NUMERIC(6,2), 'Waste Management', 'Illegal dumping spike near market.',                        TIMESTAMPTZ '2026-05-01 00:00:00+03'),
      ('Nairobi City County Government', 'NRB-003', 'monthly'::report_period, DATE '2026-04-01', DATE '2026-04-30',  19,  3,  14,  2,  0,  9.8::NUMERIC(6,2), 'Water Supply',     'Burst mains accounted for 60% of issues.',                  TIMESTAMPTZ '2026-05-01 00:00:00+03'),
      ('Nairobi City County Government', 'NRB-001', 'monthly'::report_period, DATE '2026-05-01', DATE '2026-05-31',  38,  6,  27,  4,  1, 13.1::NUMERIC(6,2), 'Roads & Potholes', 'KENHA resolved 3 major potholes mid-month.',                TIMESTAMPTZ '2026-06-01 00:00:00+03'),
      ('Nairobi City County Government', NULL,      'monthly'::report_period, DATE '2026-05-01', DATE '2026-05-31', 215, 44, 148, 18,  5, 12.4::NUMERIC(6,2), 'Roads & Potholes', 'County-wide summary. Roads top category 3 months running.', TIMESTAMPTZ '2026-06-01 00:00:00+03'),

      -- Mombasa County — quarterly
      ('Mombasa County Government', 'MSA-001', 'quarterly'::report_period, DATE '2026-01-01', DATE '2026-03-31', 88, 12, 61, 9, 6, 18.7::NUMERIC(6,2), 'Sanitation',       'Sewage overflow issues dominated Q1.',      TIMESTAMPTZ '2026-04-01 00:00:00+03'),
      ('Mombasa County Government', 'MSA-002', 'quarterly'::report_period, DATE '2026-01-01', DATE '2026-03-31', 74,  9, 55, 7, 3, 16.2::NUMERIC(6,2), 'Roads & Potholes', 'Coastal road degradation from rainfall.',   TIMESTAMPTZ '2026-04-01 00:00:00+03'),

      -- Kisumu County — quarterly
      ('Kisumu County Government', 'KSM-001', 'quarterly'::report_period, DATE '2026-01-01', DATE '2026-03-31', 56, 8, 40, 6, 2, 15.0::NUMERIC(6,2), 'Water Supply',    'Kondele water supply disruptions Q1.',      TIMESTAMPTZ '2026-04-01 00:00:00+03'),
      ('Kisumu County Government', 'KSM-002', 'quarterly'::report_period, DATE '2026-01-01', DATE '2026-03-31', 48, 7, 35, 5, 1, 13.5::NUMERIC(6,2), 'Street Lighting', 'Street light outages main complaint.',      TIMESTAMPTZ '2026-04-01 00:00:00+03'),

      -- KENHA — annual national
      ('Kenya National Highways Authority', NULL, 'annual'::report_period, DATE '2025-01-01', DATE '2025-12-31', 1240, 110, 980, 120, 30, 22.3::NUMERIC(6,2), 'Roads & Potholes', 'National roads summary 2025. 79% resolution rate.', TIMESTAMPTZ '2026-01-15 00:00:00+03'),

      -- KPLC — annual national
      ('Kenya Power & Lighting Company', NULL, 'annual'::report_period, DATE '2025-01-01', DATE '2025-12-31', 890, 95, 700, 85, 10, 9.8::NUMERIC(6,2), 'Power Outages', 'Power outage issues. 79% resolved within 10 days avg.', TIMESTAMPTZ '2026-01-15 00:00:00+03')
  ) AS v(
    authority_name,
    ward_code,
    report_period,
    period_start,
    period_end,
    total_issues,
    open_issues,
    resolved_issues,
    pending_issues,
    escalated_issues,
    avg_resolution_days,
    top_category,
    report_notes,
    generated_at
  )
),
authority_lookup AS (
  SELECT
    name AS authority_name,
    MIN(id) AS authority_id
  FROM authorities
  GROUP BY name
),
ward_lookup AS (
  SELECT
    code AS ward_code,
    MIN(id) AS ward_id
  FROM wards
  GROUP BY code
),
prepared_rows AS (
  SELECT
    a.authority_id,
    w.ward_id,
    s.report_period,
    s.period_start,
    s.period_end,
    s.total_issues,
    s.open_issues,
    s.resolved_issues,
    s.pending_issues,
    s.escalated_issues,
    s.avg_resolution_days,
    s.top_category,
    s.report_notes,
    s.generated_at
  FROM seed_rows s
  JOIN authority_lookup a
    ON a.authority_name = s.authority_name
  LEFT JOIN ward_lookup w
    ON w.ward_code = s.ward_code
  WHERE s.ward_code IS NULL OR w.ward_id IS NOT NULL
)
INSERT INTO summary_reports (
  authority_id, ward_id, report_period, period_start, period_end,
  total_issues, open_issues, resolved_issues, pending_issues, escalated_issues,
  avg_resolution_days, top_category, report_notes, generated_at
)
SELECT
  p.authority_id,
  p.ward_id,
  p.report_period,
  p.period_start,
  p.period_end,
  p.total_issues,
  p.open_issues,
  p.resolved_issues,
  p.pending_issues,
  p.escalated_issues,
  p.avg_resolution_days,
  p.top_category,
  p.report_notes,
  p.generated_at
FROM prepared_rows p
WHERE NOT EXISTS (
  SELECT 1
  FROM summary_reports existing
  WHERE existing.authority_id = p.authority_id
    AND existing.ward_id IS NOT DISTINCT FROM p.ward_id
    AND existing.report_period = p.report_period
    AND existing.period_start = p.period_start
);
