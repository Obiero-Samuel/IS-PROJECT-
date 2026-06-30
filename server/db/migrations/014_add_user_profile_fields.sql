ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(120);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS residence VARCHAR(255);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_edit_count INT NOT NULL DEFAULT 0;

UPDATE users
SET full_name = COALESCE(NULLIF(TRIM(full_name), ''), username)
WHERE full_name IS NULL OR TRIM(full_name) = '';

CREATE INDEX IF NOT EXISTS idx_users_profile_edit_count ON users(profile_edit_count);
