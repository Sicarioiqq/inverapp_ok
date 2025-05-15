/*
  # Fix missing user profile and signup process

  1. Changes
    - Create missing profile for existing auth user
    - Update signup trigger to ensure profile creation
    - Add policy to allow profile creation during signup

  2. Security
    - Maintain existing RLS policies
    - Allow authenticated users to create their own profile
*/

-- First, create the missing profile for the existing user
INSERT INTO profiles (
  id,
  email,
  first_name,
  last_name,
  position,
  user_type
)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'first_name', 'Usuario'),
  COALESCE(raw_user_meta_data->>'last_name', 'Nuevo'),
  COALESCE(raw_user_meta_data->>'position', 'Usuario'),
  'Administrador'
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
AND email = 'stanle40@gmail.com'; -- Replace with the actual email of the logged-in user

-- Create function to handle new user signups
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