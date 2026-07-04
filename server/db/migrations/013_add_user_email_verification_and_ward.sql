-- This migration adds ward linkage and email-verification OTP fields to users.
-- Link users to wards for location-scoped resident workflows.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ward_id INT REFERENCES wards(id) ON DELETE SET NULL;

-- Track whether email verification is complete.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Store hashed OTP value (never plain OTP).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_otp_hash VARCHAR(255);

-- Store OTP expiry timestamp.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_otp_expires_at TIMESTAMPTZ;

-- Keep final verification completion time.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Add lookup indexes for ward filtering and OTP expiry checks.
CREATE INDEX IF NOT EXISTS idx_users_ward_id ON users(ward_id);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_expires ON users(email_verification_otp_expires_at);
