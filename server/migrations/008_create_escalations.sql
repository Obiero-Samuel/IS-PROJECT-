-- =============================================================
-- Migration 008: Create escalations table
-- Note: FK references reports(id) — Partner A's actual table name
-- =============================================================

DO $$
BEGIN
  CREATE TYPE escalation_status AS ENUM ('pending', 'acknowledged', 'resolved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS escalations (
  id              SERIAL PRIMARY KEY,
  report_id       INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  authority_id    INT NOT NULL REFERENCES authorities(id) ON DELETE RESTRICT,
  escalated_by    INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason          TEXT NOT NULL,
  status          escalation_status NOT NULL DEFAULT 'pending',
  authority_notes TEXT,
  is_overdue      BOOLEAN NOT NULL DEFAULT FALSE,
  escalated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_report_id    ON escalations (report_id);
CREATE INDEX IF NOT EXISTS idx_escalations_authority_id ON escalations (authority_id);
CREATE INDEX IF NOT EXISTS idx_escalations_status       ON escalations (status);
CREATE INDEX IF NOT EXISTS idx_escalations_escalated_by ON escalations (escalated_by);
CREATE INDEX IF NOT EXISTS idx_escalations_is_overdue   ON escalations (is_overdue);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_escalations_updated_at'
  ) THEN
    CREATE TRIGGER trg_escalations_updated_at
      BEFORE UPDATE ON escalations
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMENT ON TABLE  escalations                 IS 'Records of reports formally escalated to governing authorities';
COMMENT ON COLUMN escalations.reason          IS 'Explanation of why the report was escalated';
COMMENT ON COLUMN escalations.authority_notes IS 'Official response or notes provided by the receiving authority';
COMMENT ON COLUMN escalations.is_overdue      IS 'Set TRUE by cron when escalation is pending >7 days without acknowledgement';
COMMENT ON COLUMN escalations.acknowledged_at IS 'Timestamp when the authority confirmed receipt';
COMMENT ON COLUMN escalations.resolved_at     IS 'Timestamp when the authority marked the escalation resolved';
