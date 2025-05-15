/*
  # Fix seller permissions for reservations and commissions

  1. Changes
    - Update RLS policies for reservations to allow sellers
    - Update RLS policies for broker_commissions to allow sellers
    - Update RLS policies for reservation_flows to allow sellers
    - Add policies for task management by sellers

  2. Security
    - Allow sellers to create and manage their reservations
    - Allow sellers to manage broker commissions
    - Allow sellers to view and manage their assigned tasks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear reservas" ON reservations;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar reservas" ON reservations;
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear comisiones" ON broker_commissions;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar comisiones" ON broker_commissions;

-- Create new policies for reservations
CREATE POLICY "Vendedores y admins pueden crear reservas"
  ON reservations FOR INSERT
  TO authenticated
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

-- Create new policies for broker commissions
CREATE POLICY "Vendedores y admins pueden crear comisiones"
  ON broker_commissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );

CREATE POLICY "Vendedores y admins pueden actualizar comisiones"
  ON broker_commissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );

-- Update policies for reservation flows
CREATE POLICY "Vendedores y admins pueden crear flujos"
  ON reservation_flows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );

CREATE POLICY "Vendedores y admins pueden actualizar flujos"
  ON reservation_flows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );

-- Update policies for reservation flow tasks
CREATE POLICY "Vendedores y admins pueden crear tareas"
  ON reservation_flow_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );

CREATE POLICY "Vendedores y admins pueden actualizar tareas"
  ON reservation_flow_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );

-- Update policies for task assignments
CREATE POLICY "Vendedores y admins pueden crear asignaciones"
  ON task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );

CREATE POLICY "Vendedores y admins pueden actualizar asignaciones"
  ON task_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );

-- Update policies for task comments
CREATE POLICY "Vendedores y admins pueden crear comentarios"
  ON task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      JOIN reservation_flow_tasks rft ON rft.reservation_flow_id = rf.id
      WHERE p.id = auth.uid()
      AND rft.id = reservation_flow_task_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );

CREATE POLICY "Vendedores y admins pueden actualizar comentarios"
  ON task_comments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      JOIN reservation_flow_tasks rft ON rft.reservation_flow_id = rf.id
      WHERE p.id = auth.uid()
      AND rft.id = reservation_flow_task_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      JOIN reservation_flow_tasks rft ON rft.reservation_flow_id = rf.id
      WHERE p.id = auth.uid()
      AND rft.id = reservation_flow_task_id
      AND (
        p.user_type = 'Administrador'
        OR p.is_seller = true
      )
    )
  );