/*
  # Fix profiles and auth.users relationship

  1. Changes
    - Drop existing foreign key constraint on profiles table
    - Add new foreign key constraint with correct reference to auth.users
    - Update profiles query to use auth.users email directly

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing foreign key if it exists
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Add correct foreign key constraint
ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id)
  ON DELETE CASCADE;