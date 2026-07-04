-- =============================================================
-- Seed 008: Seed escalations
-- Owner: Partner B
-- NOTE: Compatible with current schema (report_id).
--       Inserts up to 5 sample escalations from existing reports.
--       If reports/users/authorities are missing, this seed safely inserts 0 rows.
-- =============================================================

WITH report_candidates AS (
  SELECT id AS report_id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM reports
  ORDER BY id
  LIMIT 5
),
seed_user AS (
  SELECT id AS user_id
  FROM users
  ORDER BY id
  LIMIT 1
),
authority_candidates AS (
  SELECT id AS authority_id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS idx
  FROM authorities
),
authority_count AS (
  SELECT COUNT(*)::INT AS cnt
  FROM authority_candidates
)
INSERT INTO escalations (
  report_id,
  authority_id,
  escalated_by,
  reason,
  status,
  authority_notes,
  escalated_at,
  acknowledged_at,
  resolved_at
)
SELECT
  r.report_id,
  a.authority_id,
  u.user_id,
  'Seed escalation for report #' || r.report_id,
  CASE
    WHEN r.rn % 4 = 0 THEN 'resolved'::escalation_status
    WHEN r.rn % 3 = 0 THEN 'acknowledged'::escalation_status
    ELSE 'pending'::escalation_status
  END,
  CASE
    WHEN r.rn % 4 = 0 THEN 'Resolved sample escalation.'
    WHEN r.rn % 3 = 0 THEN 'Acknowledged sample escalation.'
    ELSE NULL
  END,
  NOW() - (r.rn || ' days')::INTERVAL,
  CASE WHEN r.rn % 3 = 0 OR r.rn % 4 = 0 THEN NOW() - ((r.rn - 1) || ' days')::INTERVAL ELSE NULL END,
  CASE WHEN r.rn % 4 = 0 THEN NOW() - ((r.rn - 2) || ' days')::INTERVAL ELSE NULL END
FROM report_candidates r
CROSS JOIN seed_user u
CROSS JOIN authority_count ac
JOIN authority_candidates a
  ON a.idx = ((r.rn - 1) % NULLIF(ac.cnt, 0))
WHERE ac.cnt > 0;
