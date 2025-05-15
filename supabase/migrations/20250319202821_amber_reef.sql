/*
  # Corregir eliminación en cascada para todas las tablas relacionadas

  1. Cambios
    - Agregar ON DELETE CASCADE a todas las foreign keys que referencian a reservations
    - Asegurar que la eliminación se propague correctamente a través de todas las tablas relacionadas

  2. Seguridad
    - Mantener las políticas RLS existentes
*/

-- Eliminar las foreign keys existentes
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

-- Recrear las foreign keys con CASCADE
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