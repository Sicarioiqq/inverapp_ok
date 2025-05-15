/*
  # Fix task dates update when completion date changes

  1. Changes
    - Update handle_task_completion function to properly propagate completion dates
    - Ensure next task's started_at is set to the completed_at of the previous task
    - Fix date handling for task progression
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Update handle_task_completion function to properly propagate dates
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS trigger AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task record;
  v_is_last_task boolean;
  v_all_tasks_completed boolean;
BEGIN
  -- Solo proceder si la tarea está siendo completada o si la fecha de completado cambió
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Obtener la posición de la tarea actual y el ID del flujo
    SELECT 
      f.flow_id,
      s."order",
      t."order"
    INTO 
      v_flow_id,
      v_current_stage_order,
      v_current_task_order
    FROM commission_flows f
    JOIN payment_flow_stages s ON s.id = f.current_stage_id
    JOIN payment_flow_tasks t ON t.id = NEW.task_id
    WHERE f.id = NEW.commission_flow_id;

    -- Obtener la siguiente tarea con su asignado por defecto
    SELECT 
      t.id as task_id,
      s.id as stage_id,
      s."order" as stage_order,
      t."order" as task_order,
      t.default_assignee_id
    INTO v_next_task
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = v_flow_id
    AND (
      (s."order" = v_current_stage_order AND t."order" > v_current_task_order) OR
      (s."order" > v_current_stage_order AND t."order" = 1)
    )
    ORDER BY s."order", t."order"
    LIMIT 1;

    -- Si hay una siguiente tarea, configurarla
    IF v_next_task IS NOT NULL THEN
      -- Actualizar la etapa actual del flujo si es necesario
      IF v_next_task.stage_order > v_current_stage_order THEN
        UPDATE commission_flows
        SET current_stage_id = v_next_task.stage_id
        WHERE id = NEW.commission_flow_id;
      END IF;

      -- Configurar la siguiente tarea como pendiente, asignar usuario por defecto
      -- y establecer la fecha de inicio como la fecha de completado de la tarea actual
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        assignee_id = v_next_task.default_assignee_id,
        assigned_at = CASE 
          WHEN v_next_task.default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END,
        started_at = NEW.completed_at, -- Usar la fecha de completado de la tarea actual como fecha de inicio
        completed_at = NULL
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_next_task.task_id;

    ELSE
      -- Verificar si esta es la última tarea
      SELECT is_last_payment_task(NEW.task_id) INTO v_is_last_task;
      
      -- Verificar si todas las tareas están completadas
      SELECT NOT EXISTS (
        SELECT 1 
        FROM commission_flow_tasks 
        WHERE commission_flow_id = NEW.commission_flow_id 
        AND status != 'completed'
      ) INTO v_all_tasks_completed;

      -- Si esta es la última tarea y todas las tareas están completadas, completar el flujo
      IF v_is_last_task AND v_all_tasks_completed THEN
        UPDATE commission_flows
        SET 
          status = 'completed',
          completed_at = now()
        WHERE id = NEW.commission_flow_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger para asegurar que use la función actualizada
DROP TRIGGER IF EXISTS on_task_completion ON commission_flow_tasks;
CREATE TRIGGER on_task_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion();

-- Función para actualizar fechas de inicio de tareas cuando cambia la fecha de completado de una tarea
CREATE OR REPLACE FUNCTION update_next_task_start_date()
RETURNS trigger AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task record;
BEGIN
  -- Solo proceder si la fecha de completado ha cambiado y la tarea está completada
  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at AND NEW.status = 'completed' THEN
    -- Obtener la posición de la tarea actual y el ID del flujo
    SELECT 
      f.flow_id,
      s."order",
      t."order"
    INTO 
      v_flow_id,
      v_current_stage_order,
      v_current_task_order
    FROM commission_flows f
    JOIN payment_flow_stages s ON s.id = f.current_stage_id
    JOIN payment_flow_tasks t ON t.id = NEW.task_id
    WHERE f.id = NEW.commission_flow_id;

    -- Obtener la siguiente tarea
    SELECT 
      cft.id as task_id,
      t.id as original_task_id,
      s.id as stage_id,
      s."order" as stage_order,
      t."order" as task_order
    INTO v_next_task
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    JOIN commission_flow_tasks cft ON cft.task_id = t.id AND cft.commission_flow_id = NEW.commission_flow_id
    WHERE s.flow_id = v_flow_id
    AND (
      (s."order" = v_current_stage_order AND t."order" > v_current_task_order) OR
      (s."order" > v_current_stage_order AND t."order" = 1)
    )
    ORDER BY s."order", t."order"
    LIMIT 1;

    -- Si hay una siguiente tarea, actualizar su fecha de inicio
    IF v_next_task IS NOT NULL THEN
      UPDATE commission_flow_tasks
      SET started_at = NEW.completed_at
      WHERE id = v_next_task.task_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar la fecha de inicio de la siguiente tarea
DROP TRIGGER IF EXISTS on_task_completion_date_change ON commission_flow_tasks;
CREATE TRIGGER on_task_completion_date_change
  AFTER UPDATE OF completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_next_task_start_date();