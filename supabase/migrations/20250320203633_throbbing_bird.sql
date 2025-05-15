-- Add new status option to operations table
DO $$ 
BEGIN
  -- Drop existing check constraint
  ALTER TABLE operations 
  DROP CONSTRAINT IF EXISTS operations_status_check;

  -- Add new check constraint with additional status
  ALTER TABLE operations
  ADD CONSTRAINT operations_status_check 
  CHECK (status IN (
    'Crédito Rechazado',
    'Tasación más baja',
    'DPS Pendiente',
    'Pendiente contacto banco'
  ));
END $$;