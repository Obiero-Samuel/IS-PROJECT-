-- =============================================================
-- Seed 013: Seed category-authority routing map
-- Purpose: Ensure officer queues have assigned reports out-of-the-box
-- =============================================================

WITH target_authority AS (
  SELECT MIN(id) AS authority_id
  FROM authorities
  WHERE name = 'Nairobi City County Government'
    AND is_active = TRUE
), category_rows AS (
  SELECT id AS category_id
  FROM categories
)
INSERT INTO category_authority_map (category_id, authority_id, response_deadline_days)
SELECT c.category_id, a.authority_id, 7
FROM category_rows c
CROSS JOIN target_authority a
WHERE a.authority_id IS NOT NULL
ON CONFLICT (category_id, authority_id)
DO UPDATE SET response_deadline_days = EXCLUDED.response_deadline_days;