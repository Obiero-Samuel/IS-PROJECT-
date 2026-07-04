-- ============================================================
-- IS PROJECT: Supervisor Database Check Script (pgAdmin)
-- Target DB: is_project_db
-- Run this whole script in pgAdmin Query Tool (F5)
-- ============================================================

-- 0) Session context
SELECT current_database() AS database_name,
       current_user     AS connected_user,
       now()            AS checked_at;


-- 1) Key tables in public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;


-- 2) Row counts for key tables (quick health snapshot)
SELECT 'users'           AS table_name, COUNT(*)::int AS row_count FROM public.users
UNION ALL
SELECT 'reports',                         COUNT(*)::int             FROM public.reports
UNION ALL
SELECT 'categories',                      COUNT(*)::int             FROM public.categories
UNION ALL
SELECT 'authorities',                     COUNT(*)::int             FROM public.authorities
UNION ALL
SELECT 'wards',                           COUNT(*)::int             FROM public.wards
UNION ALL
SELECT 'status_logs',                     COUNT(*)::int             FROM public.status_logs
UNION ALL
SELECT 'escalations',                     COUNT(*)::int             FROM public.escalations
UNION ALL
SELECT 'summary_reports',                 COUNT(*)::int             FROM public.summary_reports
ORDER BY table_name;


-- 3) Relationships / foreign keys for reports
SELECT
  tc.constraint_name,
  kcu.column_name AS reports_column,
  ccu.table_name  AS referenced_table,
  ccu.column_name AS referenced_column,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema    = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema    = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name  = tc.constraint_name
 AND rc.constraint_schema = tc.table_schema
WHERE tc.table_schema   = 'public'
  AND tc.table_name     = 'reports'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name, kcu.ordinal_position;


-- 4) Prove report_period contains weekly
SELECT unnest(enum_range(NULL::report_period)) AS report_period_value;

SELECT (
  'weekly' = ANY (enum_range(NULL::report_period)::text[])
) AS has_weekly;


-- 5) summary_reports file metadata columns (structure proof)
SELECT
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'summary_reports'
ORDER BY ordinal_position;


-- 6) summary_reports sample rows with file metadata
SELECT COUNT(*)::int AS summary_reports_total
FROM public.summary_reports;

SELECT
  id,
  authority_id,
  ward_id,
  report_period,
  period_start,
  period_end,
  report_file_type,
  report_file_url,
  generated_at
FROM public.summary_reports
ORDER BY id DESC
LIMIT 10;


-- ============================================================
-- EXTRA: If supervisor asks specifically for "schema"
-- ============================================================

-- A) reports: columns
SELECT
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'reports'
ORDER BY ordinal_position;

-- B) reports: constraints (PK/FK/UNIQUE/CHECK)
SELECT
  c.conname AS constraint_name,
  CASE c.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    ELSE c.contype::text
  END AS constraint_type,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'reports'
ORDER BY constraint_type, constraint_name;

-- C) reports: indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  = 'reports'
ORDER BY indexname;


-- D) summary_reports: columns
SELECT
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'summary_reports'
ORDER BY ordinal_position;

-- E) summary_reports: constraints
SELECT
  c.conname AS constraint_name,
  CASE c.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    ELSE c.contype::text
  END AS constraint_type,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'summary_reports'
ORDER BY constraint_type, constraint_name;

-- F) summary_reports: indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  = 'summary_reports'
ORDER BY indexname;
