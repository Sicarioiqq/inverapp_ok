/*
  # Agregar fecha de completado a tareas y restricciones de edición

  1. Cambios
    - Agregar columna completed_at que se actualiza automáticamente al completar una tarea
    - Actualizar políticas para que solo administradores puedan editar tareas completadas
    - Crear trigger para manejar la fecha de completado

  2. Seguridad
    - Mantener políticas existentes
    - Agregar restricciones para edición de tareas completadas
*/

-- Agregar columna completed_at si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservation_flow_tasks' 
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE reservation_flow_tasks 
    ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- Función para manejar el cambio de estado de la tarea
CREATE OR REPLACE FUNCTION handle_task_status_change()
RETURNS trigger AS $$
BEGIN
  -- Si la tarea se marca como completada
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  -- Si la tarea se marca como no completada
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    -- Solo permitir a administradores cambiar el estado de tareas completadas
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    ) THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar tareas completadas';
    END IF;
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar el trigger si existe
DROP TRIGGER IF EXISTS on_task_status_change ON reservation_flow_tasks;

-- Crear el trigger para manejar cambios de estado
CREATE TRIGGER on_task_status_change
  BEFORE UPDATE OF status ON reservation_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_status_change();

-- Actualizar la política de actualización de tareas
DROP POLICY IF EXISTS "Administradores pueden gestionar tareas y vendedores pueden actualizar sus tareas" ON reservation_flow_tasks;

CREATE POLICY "Administradores pueden gestionar tareas y vendedores pueden actualizar tareas no completadas"
  ON reservation_flow_tasks FOR UPDATE
  TO authenticated
  USING (
    (is_admin() OR (
      status != 'completed' AND
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN reservations r ON r.seller_id = p.id
        JOIN reservation_flows rf ON rf.reservation_id = r.id
        WHERE p.id = auth.uid()
        AND rf.id = reservation_flow_id
        AND p.is_seller = true
      )
    ))
  )
  WITH CHECK (
    (is_admin() OR (
      status != 'completed' AND
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN reservations r ON r.seller_id = p.id
        JOIN reservation_flows rf ON rf.reservation_id = r.id
        WHERE p.id = auth.uid()
        AND rf.id = reservation_flow_id
        AND p.is_seller = true
      )
    ))
  );