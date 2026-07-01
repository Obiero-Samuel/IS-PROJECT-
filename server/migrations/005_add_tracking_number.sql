-- Migration 005: Add tracking_number column to reports
-- A unique  identifier generated on report submission
-- Format: CP-YYYYMMDD-XXXX (e.g. CP-20260626-A3F7)

IF COL_LENGTH('reports', 'tracking_number') IS NULL
BEGIN
  ALTER TABLE reports
    ADD tracking_number VARCHAR(20) UNIQUE;
END;
