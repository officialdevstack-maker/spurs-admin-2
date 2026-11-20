CREATE TABLE pay_config_versions (
  version integer PRIMARY KEY,
  config jsonb NOT NULL,
  reason text NOT NULL,
  rolled_back_from integer,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pay_service_clients (
  client_id text PRIMARY KEY CHECK (client_id ~ '^[A-Za-z0-9._-]{1,64}$'),
  product text NOT NULL CHECK (product IN ('wallet')),
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX pay_service_clients_active_idx
  ON pay_service_clients (revoked_at, client_id);
