-- Actualizar el usuario admin con rol correcto
UPDATE auth.users
SET 
  raw_app_meta_data = '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
  raw_user_meta_data = '{}'::jsonb
WHERE email = 'admin@test.com';

-- Verificar el resultado
SELECT 
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'admin@test.com';
