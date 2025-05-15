/*
  # Agregar campos para resciliación de reservas

  1. Nuevos Campos
    - `is_rescinded` (boolean) - Indica si la reserva ha sido resciliada
    - `rescinded_at` (timestamptz) - Fecha y hora de la resciliación
    - `rescinded_reason` (text) - Motivo de la resciliación
    - `rescinded_by` (uuid) - Usuario que realizó la resciliación
    
  2. Cambios en broker_commissions
    - `penalty_amount` (numeric) - Monto del castigo por resciliación
    
  3. Seguridad
    - Mantener las políticas RLS existentes
*/

-- Agregar campos para resciliación a la tabla reservations
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS is_rescinded boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rescinded_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescinded_reason text,
  ADD COLUMN IF NOT EXISTS rescinded_by uuid REFERENCES auth.users(id);

-- Agregar campo para castigo a la tabla broker_commissions
ALTER TABLE broker_commissions
  ADD COLUMN IF NOT EXISTS penalty_amount numeric DEFAULT 0;

-- Crear índice para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_reservations_is_rescinded ON reservations(is_rescinded);