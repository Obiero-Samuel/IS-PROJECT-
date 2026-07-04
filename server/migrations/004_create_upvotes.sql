-- This migration creates the upvotes table for report community voting.
-- Create upvotes table only if it does not already exist.
IF OBJECT_ID(N'upvotes', N'U') IS NULL
BEGIN
  CREATE TABLE upvotes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    -- Composite key prevents duplicate upvotes per user/report pair.
    PRIMARY KEY (user_id, report_id)
  );
END;
