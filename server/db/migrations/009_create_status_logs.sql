-- =============================================================
-- Migration 009: Create status_logs table
-- Owner: Partner B
-- Description: Immutable audit trail for every issue status change
-- =============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS status_logs (
  id          SERIAL PRIMARY KEY,
  issue_id    INT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  changed_by  INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  old_status  VARCHAR(50),                               -- NULL when issue is first created
  new_status  VARCHAR(50) NOT NULL,
  notes       TEXT,                                      -- optional explanation for the change
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Intentionally NO updated_at — this table is append-only (immutable audit log)
-- Intentionally NO update trigger — rows must never be modified after insertion

CREATE INDEX idx_status_logs_issue_id   ON status_logs (issue_id);
CREATE INDEX idx_status_logs_changed_by ON status_logs (changed_by);
CREATE INDEX idx_status_logs_changed_at ON status_logs (changed_at DESC);

-- Prevent UPDATE and DELETE to enforce immutability
CREATE OR REPLACE RULE no_update_status_logs AS
  ON UPDATE TO status_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE no_delete_status_logs AS
  ON DELETE TO status_logs DO INSTEAD NOTHING;

COMMENT ON TABLE  status_logs            IS 'Append-only audit log of every status change made to an issue';
COMMENT ON COLUMN status_logs.old_status IS 'The status value before the change; NULL indicates the initial creation event';
COMMENT ON COLUMN status_logs.new_status IS 'The status value after the change';
COMMENT ON COLUMN status_logs.notes      IS 'Optional free-text reason or context for the status transition';

COMMIT;
