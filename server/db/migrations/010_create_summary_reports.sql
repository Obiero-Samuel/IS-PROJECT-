-- =============================================================
-- Migration 010: Create summary_reports table
-- Owner: Partner B
-- Description: Periodic aggregated reports per ward/authority
-- =============================================================

BEGIN;

CREATE TYPE report_period AS ENUM ('monthly', 'quarterly', 'annual');

CREATE TABLE IF NOT EXISTS summary_reports (
  id                    SERIAL PRIMARY KEY,
  authority_id          INT NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
  ward_id               INT REFERENCES wards(id) ON DELETE SET NULL,  -- NULL = entire jurisdiction
  report_period         report_period NOT NULL DEFAULT 'monthly',
  period_start          DATE NOT NULL,                                  -- first day of the period
  period_end            DATE NOT NULL,                                  -- last day of the period
  total_issues          INT NOT NULL DEFAULT 0,
  open_issues           INT NOT NULL DEFAULT 0,
  resolved_issues       INT NOT NULL DEFAULT 0,
  pending_issues        INT NOT NULL DEFAULT 0,
  escalated_issues      INT NOT NULL DEFAULT 0,
  avg_resolution_days   NUMERIC(6,2),                                  -- average days to resolve
  top_category          VARCHAR(100),                                   -- most reported category name
  report_notes          TEXT,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate reports for the same scope and period
  CONSTRAINT uq_summary_reports UNIQUE (authority_id, ward_id, report_period, period_start)
);

CREATE INDEX idx_summary_reports_authority ON summary_reports (authority_id);
CREATE INDEX idx_summary_reports_ward       ON summary_reports (ward_id);
CREATE INDEX idx_summary_reports_period     ON summary_reports (report_period, period_start DESC);

COMMENT ON TABLE  summary_reports                     IS 'Pre-aggregated periodic reports for authorities and wards';
COMMENT ON COLUMN summary_reports.ward_id             IS 'NULL means the report covers the authoritys entire jurisdiction';
COMMENT ON COLUMN summary_reports.period_start        IS 'Inclusive start date of the reporting period';
COMMENT ON COLUMN summary_reports.period_end          IS 'Inclusive end date of the reporting period';
COMMENT ON COLUMN summary_reports.avg_resolution_days IS 'Mean number of calendar days from issue creation to resolution';
COMMENT ON COLUMN summary_reports.top_category        IS 'Name of the most frequently reported issue category in this period';

COMMIT;
