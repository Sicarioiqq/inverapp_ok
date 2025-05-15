/*
  # Add OPERACIONES user type

  1. Changes
    - Add 'OPERACIONES' to user_type check constraint in profiles table
    - Maintain existing user types
    
  2. Security
    - No changes to existing policies required
*/

-- Drop existing check constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Add new check constraint with OPERACIONES type
ALTER TABLE profiles
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('Administrador', 'KAM', 'Gestor de Pagos', 'Supervisor', 'OPERACIONES'));