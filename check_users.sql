-- Ver todos los usuarios y sus metadatos
SELECT 
  id,
  email,
  raw_app_meta_data,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
