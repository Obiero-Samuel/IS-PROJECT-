-- ============================================================
-- IS PROJECT DATABASE VERIFICATION SCRIPT
-- Database: is_project_db
-- ============================================================


-- Show database information
SELECT current_database();
SELECT current_user;
SELECT NOW();


-- Show all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;


-- Count records in important tables
SELECT COUNT(*) AS users FROM users;

SELECT COUNT(*) AS reports FROM reports;

SELECT COUNT(*) AS categories FROM categories;

SELECT COUNT(*) AS authorities FROM authorities;

SELECT COUNT(*) AS wards FROM wards;

SELECT COUNT(*) AS status_logs FROM status_logs;

SELECT COUNT(*) AS escalations FROM escalations;

SELECT COUNT(*) AS summary_reports FROM summary_reports;


-- Show foreign key relationships for the reports table
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'reports'
AND tc.constraint_type = 'FOREIGN KEY';


-- Check values in report_period enum
SELECT unnest(enum_range(NULL::report_period));


-- Check if weekly exists
SELECT EXISTS
(
    SELECT 1
    FROM unnest(enum_range(NULL::report_period)) AS value
    WHERE value::TEXT = 'weekly'
);


-- Display summary_reports table structure
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'summary_reports'
ORDER BY ordinal_position;


-- Total summary reports
SELECT COUNT(*) AS total_summary_reports
FROM summary_reports;


-- Display latest summary reports
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
FROM summary_reports
ORDER BY id DESC
LIMIT 10;


-- ============================================================
-- REPORTS TABLE
-- ============================================================

-- Columns
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'reports'
ORDER BY ordinal_position;


-- Constraints
SELECT
    conname,
    pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'reports'::regclass;


-- Indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'reports';


-- ============================================================
-- SUMMARY REPORTS TABLE
-- ============================================================

-- Columns
SELECT
    ordinal_position,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'summary_reports'
ORDER BY ordinal_position;


-- Constraints
SELECT
    conname,
    pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'summary_reports'::regclass;


-- Indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'summary_reports';