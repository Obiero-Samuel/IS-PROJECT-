-- =============================================================
-- Migration 017: Add weekly period support to summary_reports
-- Description: Align report_period enum with weekly export contract.
-- =============================================================

ALTER TYPE report_period ADD VALUE IF NOT EXISTS 'weekly';
