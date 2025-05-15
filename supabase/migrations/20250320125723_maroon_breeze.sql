/*
  # Agregar permisos de administrador

  1. Cambios
    - Actualizar políticas RLS para dar acceso total a administradores
    - Mantener las políticas existentes para otros usuarios
    - Asegurar que los administradores puedan gestionar todos los recursos

  2. Seguridad
    - Verificar el tipo de usuario en cada política
    - Mantener las restricciones para usuarios no administradores
*/

-- Función auxiliar para verificar si un usuario es administrador
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar políticas para clientes
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar clientes" ON clients;
CREATE POLICY "Administradores pueden gestionar clientes y usuarios autenticados pueden actualizar"
  ON clients FOR UPDATE
  TO authenticated
  USING (is_admin() OR deleted_at IS NULL)
  WITH CHECK (is_admin() OR deleted_at IS NULL);

-- Actualizar políticas para proyectos
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar proyectos" ON projects;
CREATE POLICY "Administradores pueden gestionar proyectos y usuarios autenticados pueden actualizar"
  ON projects FOR UPDATE
  TO authenticated
  USING (is_admin() OR true)
  WITH CHECK (is_admin() OR true);

-- Actualizar políticas para inmobiliarias
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar inmobiliarias" ON real_estate_agencies;
CREATE POLICY "Administradores pueden gestionar inmobiliarias y usuarios autenticados pueden actualizar"
  ON real_estate_agencies FOR UPDATE
  TO authenticated
  USING (is_admin() OR true)
  WITH CHECK (is_admin() OR true);

-- Actualizar políticas para brokers
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar brokers" ON brokers;
CREATE POLICY "Administradores pueden gestionar brokers y usuarios autenticados pueden actualizar"
  ON brokers FOR UPDATE
  TO authenticated
  USING (is_admin() OR true)
  WITH CHECK (is_admin() OR true);

-- Actualizar políticas para reservas
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar reservas" ON reservations;
CREATE POLICY "Administradores pueden eliminar reservas"
  ON reservations FOR DELETE
  TO authenticated
  USING (is_admin());

-- Actualizar políticas para flujos de reserva
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar flujos" ON reservation_flows;
CREATE POLICY "Administradores pueden gestionar flujos y vendedores pueden actualizar sus flujos"
  ON reservation_flows FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND p.is_seller = true
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND p.is_seller = true
    )
  );

-- Actualizar políticas para tareas de flujo
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar tareas" ON reservation_flow_tasks;
CREATE POLICY "Administradores pueden gestionar tareas y vendedores pueden actualizar sus tareas"
  ON reservation_flow_tasks FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND p.is_seller = true
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND p.is_seller = true
    )
  );

-- Actualizar políticas para comentarios
DROP POLICY IF EXISTS "Administradores pueden eliminar comentarios" ON task_comments;
CREATE POLICY "Administradores pueden gestionar todos los comentarios"
  ON task_comments FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Actualizar políticas para asignaciones de tareas
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar asignaciones" ON task_assignments;
CREATE POLICY "Administradores pueden gestionar asignaciones y vendedores pueden actualizar sus asignaciones"
  ON task_assignments FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND p.is_seller = true
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN reservation_flows rf ON rf.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND rf.id = reservation_flow_id
      AND p.is_seller = true
    )
  );

-- Actualizar políticas para comisiones de broker
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar comisiones" ON broker_commissions;
CREATE POLICY "Administradores pueden gestionar comisiones y vendedores pueden actualizar sus comisiones"
  ON broker_commissions FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND p.is_seller = true
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      WHERE p.id = auth.uid()
      AND r.id = reservation_id
      AND p.is_seller = true
    )
  );