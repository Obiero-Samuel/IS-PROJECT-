-- This migration adds editable user profile fields and profile edit tracking.
-- Add basic personal identity field used in profile screens.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(120);

-- Add optional phone contact field.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);

-- Add optional date of birth field.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add optional residence/address text.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS residence VARCHAR(255);

-- Save profile photo URL/path.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Save short biography/about text.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

-- Count how many profile edits have been used.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_edit_count INT NOT NULL DEFAULT 0;

-- Backfill full_name from username for existing rows.
UPDATE users
SET full_name = COALESCE(NULLIF(TRIM(full_name), ''), username)
WHERE full_name IS NULL OR TRIM(full_name) = '';

-- Index edit counter for admin/reporting queries.
CREATE INDEX IF NOT EXISTS idx_users_profile_edit_count ON users(profile_edit_count);
