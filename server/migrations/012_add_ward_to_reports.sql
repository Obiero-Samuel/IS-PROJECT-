-- =============================================================
-- Migration 012: Add ward_id to reports

-- Description: Allows reports to be geo-scoped to specific wards
-- =============================================================

IF COL_LENGTH('reports', 'ward_id') IS NULL
BEGIN
  ALTER TABLE reports
    ADD ward_id INT NULL;

  ALTER TABLE reports
    ADD CONSTRAINT FK_reports_ward_id
    FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE SET NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'idx_reports_ward_id'
    AND object_id = OBJECT_ID('reports')
)
BEGIN
  CREATE INDEX idx_reports_ward_id ON reports(ward_id);
END;

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('reports')
    AND name = 'ward_id'
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.extended_properties ep
    WHERE ep.major_id = OBJECT_ID('reports')
      AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('reports'), 'ward_id', 'ColumnId')
      AND ep.name = 'MS_Description'
  )
  BEGIN
    EXEC sp_updateextendedproperty
      @name = N'MS_Description',
      @value = N'The ward where the issue was reported',
      @level0type = N'SCHEMA', @level0name = N'dbo',
      @level1type = N'TABLE',  @level1name = N'reports',
      @level2type = N'COLUMN', @level2name = N'ward_id';
  END
  ELSE
  BEGIN
    EXEC sp_addextendedproperty
      @name = N'MS_Description',
      @value = N'The ward where the issue was reported',
      @level0type = N'SCHEMA', @level0name = N'dbo',
      @level1type = N'TABLE',  @level1name = N'reports',
      @level2type = N'COLUMN', @level2name = N'ward_id';
  END
END;
