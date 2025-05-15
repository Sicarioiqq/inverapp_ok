/*
  # Fix broker commission permissions

  1. Changes
    - Drop and recreate all broker commission policies
    - Ensure proper access for sellers and admins
    - Fix policy conditions to properly check relationships
    - Add missing SELECT policies

  2. Security
    - Maintain data integrity
    - Ensure proper access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver comisiones" ON broker_commissions;
DROP POLICY IF EXISTS "Vendedores y admins pueden crear comisiones" ON broker_commissions;
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar comisiones" ON broker_commissions;

-- Create new policies for broker commissions
CREATE POLICY "Usuarios autenticados pueden ver comisiones"
  ON broker_commissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Vendedores y admins pueden crear comisiones"
  ON broker_commissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.id = broker_commissions.reservation_id
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR (p.is_seller = true AND r.seller_id = p.id)
      )
    )
  );

CREATE POLICY "Vendedores y admins pueden actualizar comisiones"
  ON broker_commissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.id = broker_commissions.reservation_id
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR (p.is_seller = true AND r.seller_id = p.id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.id = broker_commissions.reservation_id
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR (p.is_seller = true AND r.seller_id = p.id)
      )
    )
  );