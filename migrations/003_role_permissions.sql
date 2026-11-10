ALTER TABLE admin_roles
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}';

UPDATE admin_roles
SET permissions = '{*}'
WHERE dashboards @> ARRAY['*']::text[]
  AND cardinality(permissions) = 0;
