-- Migration 005: Add tracking_number column to reports
-- A unique human-readable identifier generated on report submission
-- Format: CP-YYYYMMDD-XXXX (e.g. CP-20260626-A3F7)

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(20) UNIQUE;
