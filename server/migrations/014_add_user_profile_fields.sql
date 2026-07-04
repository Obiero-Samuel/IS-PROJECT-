-- This migration adds editable user profile fields and profile edit tracking.
-- Add full name field when missing.
IF COL_LENGTH('users', 'full_name') IS NULL
BEGIN;
  ALTER TABLE users
    ADD full_name VARCHAR(120);
END;

-- Add phone number field when missing.
IF COL_LENGTH('users', 'phone_number') IS NULL
BEGIN;
  ALTER TABLE users
    ADD phone_number VARCHAR(30);
END;

-- Add date of birth field when missing.
IF COL_LENGTH('users', 'date_of_birth') IS NULL
BEGIN;
  ALTER TABLE users
    ADD date_of_birth DATE;
END;

-- Add residence/address field when missing.
IF COL_LENGTH('users', 'residence') IS NULL
BEGIN;
  ALTER TABLE users
    ADD residence VARCHAR(255);
END;

-- Add profile photo URL field when missing.
IF COL_LENGTH('users', 'profile_photo_url') IS NULL
BEGIN;
  ALTER TABLE users
    ADD profile_photo_url TEXT;
END;

-- Add bio field when missing.
IF COL_LENGTH('users', 'bio') IS NULL
BEGIN;
  ALTER TABLE users
    ADD bio VARCHAR(500);
END;

-- Add edit counter with default zero when missing.
IF COL_LENGTH('users', 'profile_edit_count') IS NULL
BEGIN;
  ALTER TABLE users
    ADD profile_edit_count INT NOT NULL CONSTRAINT DF_users_profile_edit_count DEFAULT 0;
END;

-- Backfill full_name from username where it is blank.
UPDATE users
SET full_name = COALESCE(NULLIF(TRIM(full_name), ''), username)
WHERE full_name IS NULL OR TRIM(full_name) = '';

-- Add index for profile edit count queries.
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'idx_users_profile_edit_count'
    AND object_id = OBJECT_ID('users')
)
BEGIN;
  CREATE INDEX idx_users_profile_edit_count ON users(profile_edit_count);
END;
