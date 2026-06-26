-- =============================================================
-- Migration 009: Create status_logs table
-- Owner: Partner B
-- Description: Immutable audit trail for every report status change
-- Note: FK references reports(id) — Partner A's actual table name
-- =============================================================

CREATE TABLE IF NOT EXISTS status_logs (
  id          SERIAL PRIMARY KEY,
  report_id   INT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  changed_by  INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  old_status  VARCHAR(50),
  new_status  VARCHAR(50) NOT NULL,
  notes       TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intentionally NO updated_at — this table is append-only (immutable audit log)

CREATE INDEX IF NOT EXISTS idx_status_logs_report_id  ON status_logs (report_id);
CREATE INDEX IF NOT EXISTS idx_status_logs_changed_by ON status_logs (changed_by);
CREATE INDEX IF NOT EXISTS idx_status_logs_changed_at ON status_logs (changed_at DESC);

-- Prevent UPDATE and DELETE to enforce immutability
CREATE OR REPLACE RULE no_update_status_logs AS
  ON UPDATE TO status_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_status_logs AS
  ON DELETE TO status_logs DO INSTEAD NOTHING;

COMMENT ON TABLE  status_logs            IS 'Append-only audit log of every status change made to a report';
COMMENT ON COLUMN status_logs.old_status IS 'Status before change; NULL = initial creation event';
COMMENT ON COLUMN status_logs.new_status IS 'Status after the change';
COMMENT ON COLUMN status_logs.notes      IS 'Optional reason or context for the status transition';
