/*
  # Fix user profile and auth handling

  1. Changes
    - Create profile for existing auth user if missing
    - Set up trigger for automatic profile creation on new signups
    - Ensure proper user type assignment

  2. Security
    - Maintain existing RLS policies
    - Use SECURITY DEFINER for proper permissions
*/

-- First, ensure the trigger function exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    position,
    user_type
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Nuevo'),
    COALESCE(NEW.raw_user_meta_data->>'position', 'Usuario'),
    'Administrador'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signups if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Create missing profiles for any existing auth users
INSERT INTO profiles (
  id,
  email,
  first_name,
  last_name,
  position,
  user_type
)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'first_name', 'Usuario'),
  COALESCE(u.raw_user_meta_data->>'last_name', 'Nuevo'),
  COALESCE(u.raw_user_meta_data->>'position', 'Usuario'),
  'Administrador'
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;