INSERT INTO admin_roles (name, description, dashboards, permissions)
VALUES
  ('Block Busters Viewer', 'Read-only access to Block Busters', '{blockbusters}', '{blockbusters.view}'),
  ('Block Busters Editor', 'Create and edit Block Busters titles and media', '{blockbusters}', '{blockbusters.view,blockbusters.write}'),
  ('Block Busters Publisher', 'Edit and publish Block Busters titles', '{blockbusters}', '{blockbusters.view,blockbusters.write,blockbusters.publish}')
ON CONFLICT (lower(name)) DO NOTHING;
