-- Agregar índices compuestos para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_commission_flows_status_created
  ON commission_flows(status, created_at);

CREATE INDEX IF NOT EXISTS idx_commission_flow_tasks_status_created
  ON commission_flow_tasks(status, created_at);

CREATE INDEX IF NOT EXISTS idx_task_assignments_user_task
  ON task_assignments(user_id, task_id);

CREATE INDEX IF NOT EXISTS idx_reservation_flows_status_created
  ON reservation_flows(status, created_at);

-- Agregar índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_broker_commissions_created
  ON broker_commissions(created_at);

CREATE INDEX IF NOT EXISTS idx_reservations_seller_created
  ON reservations(seller_id, created_at);

CREATE INDEX IF NOT EXISTS idx_profiles_user_type
  ON profiles(user_type);

-- Asegurar que las columnas de estado tienen valores válidos
ALTER TABLE commission_flows
  DROP CONSTRAINT IF EXISTS commission_flows_status_check,
  ADD CONSTRAINT commission_flows_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE commission_flow_tasks
  DROP CONSTRAINT IF EXISTS commission_flow_tasks_status_check,
  ADD CONSTRAINT commission_flow_tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked'));

-- Agregar restricciones de integridad referencial con CASCADE donde sea apropiado
ALTER TABLE commission_flows
  DROP CONSTRAINT IF EXISTS commission_flows_broker_commission_id_fkey,
  ADD CONSTRAINT commission_flows_broker_commission_id_fkey
  FOREIGN KEY (broker_commission_id)
  REFERENCES broker_commissions(id)
  ON DELETE CASCADE;

ALTER TABLE commission_flow_tasks
  DROP CONSTRAINT IF EXISTS commission_flow_tasks_commission_flow_id_fkey,
  ADD CONSTRAINT commission_flow_tasks_commission_flow_id_fkey
  FOREIGN KEY (commission_flow_id)
  REFERENCES commission_flows(id)
  ON DELETE CASCADE;

ALTER TABLE commission_task_comments
  DROP CONSTRAINT IF EXISTS commission_task_comments_commission_flow_task_id_fkey,
  ADD CONSTRAINT commission_task_comments_commission_flow_task_id_fkey
  FOREIGN KEY (commission_flow_task_id)
  REFERENCES commission_flow_tasks(id)
  ON DELETE CASCADE;

-- Agregar restricciones NOT NULL y valores por defecto
-- Primero establecer valores por defecto
ALTER TABLE commission_flows
  ALTER COLUMN is_second_payment SET DEFAULT false;

ALTER TABLE commission_flow_tasks
  ALTER COLUMN status SET DEFAULT 'pending';

-- Luego establecer restricciones NOT NULL
ALTER TABLE commission_flows
  ALTER COLUMN broker_commission_id SET NOT NULL,
  ALTER COLUMN flow_id SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN is_second_payment SET NOT NULL;

ALTER TABLE commission_flow_tasks
  ALTER COLUMN commission_flow_id SET NOT NULL,
  ALTER COLUMN task_id SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

-- Actualizar las políticas RLS para mejorar el rendimiento
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver flujos de comisión" ON commission_flows;
CREATE POLICY "Usuarios autenticados pueden ver flujos de comisión"
  ON commission_flows FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver tareas de comisión" ON commission_flow_tasks;
CREATE POLICY "Usuarios autenticados pueden ver tareas de comisión"
  ON commission_flow_tasks FOR SELECT
  TO authenticated
  USING (true);

-- Agregar triggers para mantener la consistencia de los datos
CREATE OR REPLACE FUNCTION update_commission_flow_status()
RETURNS trigger AS $$
BEGIN
  -- Actualizar el estado del flujo basado en las tareas
  IF EXISTS (
    SELECT 1 FROM commission_flow_tasks
    WHERE commission_flow_id = NEW.commission_flow_id
    AND status = 'completed'
  ) AND NOT EXISTS (
    SELECT 1 FROM commission_flow_tasks
    WHERE commission_flow_id = NEW.commission_flow_id
    AND status != 'completed'
  ) THEN
    UPDATE commission_flows
    SET 
      status = 'completed',
      completed_at = now()
    WHERE id = NEW.commission_flow_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_commission_flow_status ON commission_flow_tasks;
CREATE TRIGGER trigger_update_commission_flow_status
  AFTER INSERT OR UPDATE OF status
  ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_flow_status();