/*
  # Fix Operaciones user type and ensure proper casing

  1. Changes
    - Drop existing check constraint
    - Add new check constraint with correct casing
    - Update any existing profiles with incorrect casing
    - Ensure Operaciones is a valid user type

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing check constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Add new check constraint with Operaciones type
ALTER TABLE profiles
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('Administrador', 'KAM', 'Gestor de Pagos', 'Supervisor', 'Operaciones'));

-- Update any existing profiles with incorrect casing
UPDATE profiles 
SET user_type = 'Operaciones' 
WHERE user_type IN ('OPERACIONES', 'operaciones');