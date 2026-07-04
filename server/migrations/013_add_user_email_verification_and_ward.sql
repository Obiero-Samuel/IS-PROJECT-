-- This migration adds ward linkage and email-verification OTP fields to users.
-- Add ward foreign key column when missing.
IF COL_LENGTH('users', 'ward_id') IS NULL
BEGIN
  ALTER TABLE users ADD ward_id INT NULL;
  ALTER TABLE users
    ADD CONSTRAINT FK_users_ward_id_wards_id
    FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE SET NULL;
END;

-- Add boolean verification state column.
IF COL_LENGTH('users', 'is_email_verified') IS NULL
BEGIN
  ALTER TABLE users ADD is_email_verified BIT NOT NULL CONSTRAINT DF_users_is_email_verified DEFAULT (0);
END;

-- Add hashed OTP storage column.
IF COL_LENGTH('users', 'email_verification_otp_hash') IS NULL
BEGIN
  ALTER TABLE users ADD email_verification_otp_hash VARCHAR(255) NULL;
END;

-- Add OTP expiry timestamp column.
IF COL_LENGTH('users', 'email_verification_otp_expires_at') IS NULL
BEGIN
  ALTER TABLE users ADD email_verification_otp_expires_at DATETIMEOFFSET NULL;
END;

-- Add timestamp for successful verification completion.
IF COL_LENGTH('users', 'email_verified_at') IS NULL
BEGIN
  ALTER TABLE users ADD email_verified_at DATETIMEOFFSET NULL;
END;

-- Add index to speed up ward-based lookups.
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'idx_users_ward_id'
    AND object_id = OBJECT_ID('users')
)
BEGIN
  CREATE INDEX idx_users_ward_id ON users(ward_id);
END;

-- Add index to speed up OTP expiry checks.
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'idx_users_email_verification_expires'
    AND object_id = OBJECT_ID('users')
)
BEGIN
  CREATE INDEX idx_users_email_verification_expires ON users(email_verification_otp_expires_at);
END;
