ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_suspended_at timestamptz;

UPDATE users
SET admin_suspended_at = suspended_at
WHERE is_admin = true
  AND admin_suspended_at IS NULL
  AND suspended_at IS NOT NULL;
