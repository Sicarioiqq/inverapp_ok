/*
  # Add Operaciones user type

  1. Changes
    - Update user_type check constraint to include 'Operaciones'
    - Ensure consistent casing for user types
    - Update any existing profiles if needed
    
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
WHERE user_type = 'OPERACIONES';