ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_suspended_at timestamptz;
