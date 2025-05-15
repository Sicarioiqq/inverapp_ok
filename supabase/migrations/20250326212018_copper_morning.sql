-- Actualizar el estado por defecto de los flujos de comisión
ALTER TABLE commission_flows
  ALTER COLUMN status SET DEFAULT 'pending';

-- Actualizar flujos existentes que no tengan estado
UPDATE commission_flows 
SET status = 'pending' 
WHERE status IS NULL;

-- Función para verificar si una tarea está bloqueada
CREATE OR REPLACE FUNCTION is_task_blocked(
  p_flow_id uuid,
  p_stage_order int,
  p_task_order int,
  p_flow_status text
) RETURNS boolean AS $$
BEGIN
  -- Si el flujo está pendiente, todas las tareas están bloqueadas
  IF p_flow_status = 'pending' THEN
    RETURN true;
  END IF;
  
  -- La primera tarea de la primera etapa nunca está bloqueada si el flujo está en progreso
  IF p_stage_order = 1 AND p_task_order = 1 AND p_flow_status = 'in_progress' THEN
    RETURN false;
  END IF;
  
  -- Para las demás tareas, verificar que la tarea anterior esté completada
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Trigger para manejar el estado de las tareas
CREATE OR REPLACE FUNCTION handle_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_is_admin boolean;
  v_flow_status text;
  v_stage_order int;
  v_task_order int;
  v_is_blocked boolean;
BEGIN
  -- Obtener el estado del flujo y el orden de la tarea
  SELECT 
    cf.status,
    pfs."order",
    pft."order"
  INTO 
    v_flow_status,
    v_stage_order,
    v_task_order
  FROM commission_flows cf
  JOIN payment_flow_stages pfs ON pfs.id = cf.current_stage_id
  JOIN payment_flow_tasks pft ON pft.stage_id = pfs.id
  WHERE cf.id = NEW.commission_flow_id;

  -- Verificar si la tarea está bloqueada
  v_is_blocked := is_task_blocked(
    NEW.commission_flow_id,
    v_stage_order,
    v_task_order,
    v_flow_status
  );

  -- Si la tarea está bloqueada, no permitir cambios
  IF v_is_blocked AND NEW.status != 'blocked' THEN
    RAISE EXCEPTION 'No se puede modificar una tarea bloqueada';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
DROP TRIGGER IF EXISTS on_task_status_change ON commission_flow_tasks;
CREATE TRIGGER on_task_status_change
  BEFORE UPDATE OF status ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_status_change();