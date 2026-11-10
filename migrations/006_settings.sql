CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
