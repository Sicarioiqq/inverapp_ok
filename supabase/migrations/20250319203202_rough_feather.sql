/*
  # Corregir eliminación en cascada de reservas

  1. Cambios
    - Verificar y recrear todas las foreign keys con ON DELETE CASCADE
    - Asegurar que la eliminación se propague correctamente
    - Agregar índices faltantes para mejor rendimiento

  2. Notas
    - Se eliminan y recrean todas las relaciones para asegurar consistencia
    - Se mantienen las políticas RLS existentes
*/

-- Eliminar todas las foreign keys existentes
ALTER TABLE reservation_flows 
  DROP CONSTRAINT IF EXISTS reservation_flows_reservation_id_fkey;

ALTER TABLE broker_commissions 
  DROP CONSTRAINT IF EXISTS broker_commissions_reservation_id_fkey;

ALTER TABLE reservation_flow_tasks
  DROP CONSTRAINT IF EXISTS reservation_flow_tasks_reservation_flow_id_fkey;

ALTER TABLE task_assignments
  DROP CONSTRAINT IF EXISTS task_assignments_reservation_flow_task_id_fkey;

ALTER TABLE task_comments
  DROP CONSTRAINT IF EXISTS task_comments_reservation_flow_task_id_fkey;

-- Recrear todas las foreign keys con ON DELETE CASCADE
ALTER TABLE reservation_flows
  ADD CONSTRAINT reservation_flows_reservation_id_fkey
  FOREIGN KEY (reservation_id)
  REFERENCES reservations(id)
  ON DELETE CASCADE;

ALTER TABLE broker_commissions
  ADD CONSTRAINT broker_commissions_reservation_id_fkey
  FOREIGN KEY (reservation_id)
  REFERENCES reservations(id)
  ON DELETE CASCADE;

ALTER TABLE reservation_flow_tasks
  ADD CONSTRAINT reservation_flow_tasks_reservation_flow_id_fkey
  FOREIGN KEY (reservation_flow_id)
  REFERENCES reservation_flows(id)
  ON DELETE CASCADE;

ALTER TABLE task_assignments
  ADD CONSTRAINT task_assignments_reservation_flow_task_id_fkey
  FOREIGN KEY (reservation_flow_task_id)
  REFERENCES reservation_flow_tasks(id)
  ON DELETE CASCADE;

ALTER TABLE task_comments
  ADD CONSTRAINT task_comments_reservation_flow_task_id_fkey
  FOREIGN KEY (reservation_flow_task_id)
  REFERENCES reservation_flow_tasks(id)
  ON DELETE CASCADE;

-- Agregar índices faltantes para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_reservation_flows_reservation_id 
  ON reservation_flows(reservation_id);

CREATE INDEX IF NOT EXISTS idx_broker_commissions_reservation_id 
  ON broker_commissions(reservation_id);

CREATE INDEX IF NOT EXISTS idx_reservation_flow_tasks_flow_id 
  ON reservation_flow_tasks(reservation_flow_id);

-- Actualizar la política de eliminación para reservations
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar reservas" ON reservations;

CREATE POLICY "Usuarios autenticados pueden eliminar reservas" 
  ON reservations FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'Administrador'
    )
  );