/*
  # Fix operations status constraint

  1. Changes
    - Drop existing status check constraint
    - Add new check constraint with all valid status options
    - Ensure existing data complies with new constraint
*/

-- Drop existing check constraint
ALTER TABLE operations 
DROP CONSTRAINT IF EXISTS operations_status_check;

-- Add new check constraint with all valid status options
ALTER TABLE operations
ADD CONSTRAINT operations_status_check 
CHECK (status IN (
  'Crédito Rechazado',
  'Tasación más baja',
  'DPS Pendiente',
  'Pendiente contacto banco',
  'Pendiente Tasación'
));

-- Update any invalid status values to NULL
UPDATE operations 
SET status = NULL 
WHERE status NOT IN (
  'Crédito Rechazado',
  'Tasación más baja',
  'DPS Pendiente',
  'Pendiente contacto banco',
  'Pendiente Tasación'
);