IF COL_LENGTH('users', 'ward_id') IS NULL
BEGIN
  ALTER TABLE users ADD ward_id INT NULL;
  ALTER TABLE users
    ADD CONSTRAINT FK_users_ward_id_wards_id
    FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE SET NULL;
END;

IF COL_LENGTH('users', 'is_email_verified') IS NULL
BEGIN
  ALTER TABLE users ADD is_email_verified BIT NOT NULL CONSTRAINT DF_users_is_email_verified DEFAULT (0);
END;

IF COL_LENGTH('users', 'email_verification_otp_hash') IS NULL
BEGIN
  ALTER TABLE users ADD email_verification_otp_hash VARCHAR(255) NULL;
END;

IF COL_LENGTH('users', 'email_verification_otp_expires_at') IS NULL
BEGIN
  ALTER TABLE users ADD email_verification_otp_expires_at DATETIMEOFFSET NULL;
END;

IF COL_LENGTH('users', 'email_verified_at') IS NULL
BEGIN
  ALTER TABLE users ADD email_verified_at DATETIMEOFFSET NULL;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'idx_users_ward_id'
    AND object_id = OBJECT_ID('users')
)
BEGIN
  CREATE INDEX idx_users_ward_id ON users(ward_id);
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'idx_users_email_verification_expires'
    AND object_id = OBJECT_ID('users')
)
BEGIN
  CREATE INDEX idx_users_email_verification_expires ON users(email_verification_otp_expires_at);
END;
