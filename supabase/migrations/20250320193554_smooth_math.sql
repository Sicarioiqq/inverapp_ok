-- Drop existing check constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Add new check constraint with updated Operaciones type
ALTER TABLE profiles
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('Administrador', 'KAM', 'Gestor de Pagos', 'Supervisor', 'Operaciones'));

-- Update any existing profiles with old OPERACIONES type
UPDATE profiles 
SET user_type = 'Operaciones' 
WHERE user_type = 'OPERACIONES';