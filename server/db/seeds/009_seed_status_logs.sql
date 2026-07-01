-- =============================================================
-- Seed 009: Seed status_logs
-- Owner: Partner B
-- NOTE: Compatible with current schema (report_id).
--       Inserts one baseline audit entry per available report.
--       If reports/users are missing, this seed safely inserts 0 rows.
-- =============================================================

WITH report_candidates AS (
  SELECT TOP (20)
    id AS report_id,
    ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM reports
),
seed_user AS (
  SELECT TOP (1)
    id AS user_id
  FROM users
  ORDER BY id
)
INSERT INTO status_logs (
  report_id,
  changed_by,
  old_status,
  new_status,
  notes,
  changed_at
)
SELECT
  r.report_id,
  u.user_id,
  NULL,
  'pending',
  CONCAT('Seed status log for report #', r.report_id),
  DATEADD(DAY, -r.rn, GETDATE())
FROM report_candidates r
CROSS JOIN seed_user u;
