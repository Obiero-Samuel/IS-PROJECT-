-- =============================================================
-- Migration 015: Canonical flow-contract tables
-- Description: Adds canonical shared storage tables required by
--              Input → Processing → Storage → Output architecture.
--              - audit_trail (maps from status_logs + escalation events)
--              - analytics   (weekly response metrics)
--              - sessions    (automated trigger run history)
-- =============================================================

CREATE TABLE IF NOT EXISTS sessions (
  id                    BIGSERIAL PRIMARY KEY,
  trigger_name          VARCHAR(80) NOT NULL,
  triggered_by          VARCHAR(20) NOT NULL CHECK (triggered_by IN ('system', 'admin', 'officer')),
  triggered_by_user_id  INT REFERENCES users(id) ON DELETE SET NULL,
  status                VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at              TIMESTAMPTZ,
  records_processed     INT NOT NULL DEFAULT 0,
  error_message         TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_trigger_name ON sessions(trigger_name);
CREATE INDEX IF NOT EXISTS idx_sessions_status       ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at   ON sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS analytics (
  id                    BIGSERIAL PRIMARY KEY,
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  total_reports         INT NOT NULL DEFAULT 0,
  resolved_reports      INT NOT NULL DEFAULT 0,
  pending_reports       INT NOT NULL DEFAULT 0,
  in_progress_reports   INT NOT NULL DEFAULT 0,
  overdue_escalations   INT NOT NULL DEFAULT 0,
  response_rate_pct     NUMERIC(6,2) NOT NULL DEFAULT 0,
  generated_session_id  BIGINT REFERENCES sessions(id) ON DELETE SET NULL,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_analytics_period UNIQUE (period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_analytics_generated_at ON analytics(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_period       ON analytics(period_start DESC, period_end DESC);

CREATE TABLE IF NOT EXISTS audit_trail (
  id                    BIGSERIAL PRIMARY KEY,
  report_id             INT REFERENCES reports(id) ON DELETE CASCADE,
  actor_user_id         INT REFERENCES users(id) ON DELETE SET NULL,
  actor_role            VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (actor_role IN ('resident', 'authority', 'admin', 'system')),
  action_type           VARCHAR(60) NOT NULL,
  old_status            VARCHAR(50),
  new_status            VARCHAR(50),
  notes                 TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_status_log_id  INT UNIQUE REFERENCES status_logs(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_report_id   ON audit_trail(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_actor       ON audit_trail(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action      ON audit_trail(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at  ON audit_trail(created_at DESC);

CREATE OR REPLACE FUNCTION sync_status_logs_to_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
  actor_role_value VARCHAR(20);
BEGIN
  SELECT role INTO actor_role_value FROM users WHERE id = NEW.changed_by;

  INSERT INTO audit_trail (
    report_id,
    actor_user_id,
    actor_role,
    action_type,
    old_status,
    new_status,
    notes,
    metadata,
    source_status_log_id,
    created_at
  )
  VALUES (
    NEW.report_id,
    NEW.changed_by,
    COALESCE(actor_role_value, 'system'),
    CASE WHEN NEW.old_status IS NULL THEN 'report_submitted' ELSE 'status_changed' END,
    NEW.old_status,
    NEW.new_status,
    NEW.notes,
    jsonb_build_object('source', 'status_logs'),
    NEW.id,
    NEW.changed_at
  )
  ON CONFLICT (source_status_log_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_status_logs_to_audit_trail'
  ) THEN
    CREATE TRIGGER trg_status_logs_to_audit_trail
      AFTER INSERT ON status_logs
      FOR EACH ROW
      EXECUTE FUNCTION sync_status_logs_to_audit_trail();
  END IF;
END $$;

INSERT INTO audit_trail (
  report_id,
  actor_user_id,
  actor_role,
  action_type,
  old_status,
  new_status,
  notes,
  metadata,
  source_status_log_id,
  created_at
)
SELECT
  sl.report_id,
  sl.changed_by,
  COALESCE(u.role, 'system'),
  CASE WHEN sl.old_status IS NULL THEN 'report_submitted' ELSE 'status_changed' END,
  sl.old_status,
  sl.new_status,
  sl.notes,
  jsonb_build_object('source', 'status_logs', 'backfill', true),
  sl.id,
  sl.changed_at
FROM status_logs sl
LEFT JOIN users u ON u.id = sl.changed_by
ON CONFLICT (source_status_log_id) DO NOTHING;
