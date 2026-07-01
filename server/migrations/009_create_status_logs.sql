-- =============================================================
-- Migration 009: Create status_logs table

-- Description: audit trail for every report status change
-- Note: FK references reports(id) — Partner A's actual table name
-- =============================================================

IF OBJECT_ID('dbo.status_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.status_logs (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    report_id   INT NOT NULL,
    changed_by  INT NOT NULL,
    old_status  VARCHAR(50) NULL,
    new_status  VARCHAR(50) NOT NULL,
    notes       NVARCHAR(MAX) NULL,
    changed_at  DATETIMEOFFSET NOT NULL CONSTRAINT DF_status_logs_changed_at DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT FK_status_logs_report_id FOREIGN KEY (report_id) REFERENCES dbo.reports(id) ON DELETE CASCADE,
    CONSTRAINT FK_status_logs_changed_by FOREIGN KEY (changed_by) REFERENCES dbo.users(id)
  );
END;

-- Intentionally NO updated_at — this table is append-only (immutable audit log)

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_status_logs_report_id' AND object_id = OBJECT_ID('dbo.status_logs'))
  CREATE INDEX idx_status_logs_report_id  ON dbo.status_logs (report_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_status_logs_changed_by' AND object_id = OBJECT_ID('dbo.status_logs'))
  CREATE INDEX idx_status_logs_changed_by ON dbo.status_logs (changed_by);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_status_logs_changed_at' AND object_id = OBJECT_ID('dbo.status_logs'))
  CREATE INDEX idx_status_logs_changed_at ON dbo.status_logs (changed_at DESC);

-- Prevent UPDATE and DELETE to enforce immutability
IF OBJECT_ID('dbo.trg_no_update_status_logs', 'TR') IS NOT NULL
  DROP TRIGGER dbo.trg_no_update_status_logs;
GO
CREATE TRIGGER dbo.trg_no_update_status_logs
ON dbo.status_logs
INSTEAD OF UPDATE
AS
BEGIN
  RETURN;
END;
GO

IF OBJECT_ID('dbo.trg_no_delete_status_logs', 'TR') IS NOT NULL
  DROP TRIGGER dbo.trg_no_delete_status_logs;
GO
CREATE TRIGGER dbo.trg_no_delete_status_logs
ON dbo.status_logs
INSTEAD OF DELETE
AS
BEGIN
  RETURN;
END;
GO

-- Append-only audit log of every status change made to a report
-- old_status: Status before change; NULL = initial creation event
-- new_status: Status after the change
-- notes: Optional reason or context for the status transition
