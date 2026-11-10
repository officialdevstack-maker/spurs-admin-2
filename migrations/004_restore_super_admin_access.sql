UPDATE admin_roles
SET dashboards = '{*}',
    permissions = '{*}'
WHERE lower(name) = 'super admin';
