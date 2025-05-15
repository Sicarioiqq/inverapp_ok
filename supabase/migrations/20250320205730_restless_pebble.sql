/*
  # Add seller relationship to reservations table

  1. Changes
    - Add foreign key constraint between reservations.seller_id and profiles.id
    - Update existing policies to handle seller relationship
    - Add index for better performance

  2. Security
    - Maintain existing RLS policies
*/

-- First drop existing constraint if it exists
ALTER TABLE reservations 
DROP CONSTRAINT IF EXISTS new_reservations_seller_id_fkey1;

-- Add the correct foreign key constraint
ALTER TABLE reservations
ADD CONSTRAINT reservations_seller_id_fkey
FOREIGN KEY (seller_id)
REFERENCES profiles(id);

-- Add index for seller_id for better performance
CREATE INDEX IF NOT EXISTS idx_reservations_seller_id
ON reservations(seller_id);

-- Update policies to use the new relationship
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar reservas" ON reservations;
CREATE POLICY "Vendedores y admins pueden actualizar reservas"
  ON reservations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        user_type = 'Administrador'
        OR (is_seller = true AND id = seller_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        user_type = 'Administrador'
        OR (is_seller = true AND id = seller_id)
      )
    )
  );