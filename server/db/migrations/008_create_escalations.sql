-- =============================================================
-- Migration 008: Create escalations table
-- Owner: Partner B
-- Description: Tracks when an issue is escalated to an authority
-- =============================================================

BEGIN;

CREATE TYPE escalation_status AS ENUM ('pending', 'acknowledged', 'resolved', 'rejected');

CREATE TABLE IF NOT EXISTS escalations (
  id              SERIAL PRIMARY KEY,
  issue_id        INT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  authority_id    INT NOT NULL REFERENCES authorities(id) ON DELETE RESTRICT,
  escalated_by    INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason          TEXT NOT NULL,
  status          escalation_status NOT NULL DEFAULT 'pending',
  authority_notes TEXT,                                  -- response notes from the authority
  escalated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escalations_issue_id     ON escalations (issue_id);
CREATE INDEX idx_escalations_authority_id ON escalations (authority_id);
CREATE INDEX idx_escalations_status       ON escalations (status);
CREATE INDEX idx_escalations_escalated_by ON escalations (escalated_by);

CREATE TRIGGER trg_escalations_updated_at
  BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE  escalations                   IS 'Records of issues formally escalated to governing authorities';
COMMENT ON COLUMN escalations.reason            IS 'Explanation of why the issue was escalated';
COMMENT ON COLUMN escalations.authority_notes   IS 'Official response or notes provided by the receiving authority';
COMMENT ON COLUMN escalations.acknowledged_at   IS 'Timestamp when the authority confirmed receipt of the escalation';
COMMENT ON COLUMN escalations.resolved_at       IS 'Timestamp when the authority marked the escalation as resolved';

COMMIT;
