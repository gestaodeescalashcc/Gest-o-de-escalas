/*
  # Add Settings Permission to Administrador Role

  1. Changes
    - Adds 'settings' permission with full CRUD to Administrador role
    - This enables administrators to manage establishments and other system settings

  2. Security
    - Only Administrador role receives this permission
    - Required for editing establishments in the REP-P system
*/

UPDATE user_roles
SET permissions = permissions || '{"settings": {"read": true, "create": true, "update": true, "delete": true}}'::jsonb
WHERE name = 'Administrador';
