/*
  # Fix reservation flow permissions

  1. Changes
    - Drop and recreate all reservation flow related policies
    - Ensure proper access for sellers and admins
    - Fix policy conditions to properly check relationships
    - Add missing SELECT policies

  2. Security
    - Maintain data integrity
    - Ensure proper access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver flujos de reserva" ON reservation_flows;
DROP POLICY IF EXISTS "Vendedores y admins pueden crear flujos" ON reservation_flows;
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar flujos" ON reservation_flows;

-- Create new policies for reservation flows
CREATE POLICY "Usuarios autenticados pueden ver flujos de reserva"
  ON reservation_flows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Vendedores y admins pueden crear flujos"
  ON reservation_flows FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR (
          p.is_seller = true
          AND EXISTS (
            SELECT 1 FROM reservations r
            WHERE r.id = reservation_id
            AND r.seller_id = p.id
          )
        )
      )
    )
  );

CREATE POLICY "Vendedores y admins pueden actualizar flujos"
  ON reservation_flows FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.id = reservation_flows.reservation_id
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
      JOIN reservations r ON r.id = reservation_flows.reservation_id
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR (p.is_seller = true AND r.seller_id = p.id)
      )
    )
  );

-- Drop existing policies for flow tasks
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver tareas de reserva" ON reservation_flow_tasks;
DROP POLICY IF EXISTS "Vendedores y admins pueden crear tareas" ON reservation_flow_tasks;
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar tareas" ON reservation_flow_tasks;

-- Create new policies for flow tasks
CREATE POLICY "Usuarios autenticados pueden ver tareas de reserva"
  ON reservation_flow_tasks FOR SELECT
  TO authenticated
  USING (true);

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

-- Drop existing policies for task assignments
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Vendedores y admins pueden crear asignaciones" ON task_assignments;
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar asignaciones" ON task_assignments;

-- Create new policies for task assignments
CREATE POLICY "Usuarios autenticados pueden ver asignaciones"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (true);

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