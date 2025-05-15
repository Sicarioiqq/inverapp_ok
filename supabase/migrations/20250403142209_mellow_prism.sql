/*
  # Actualizar manejo de fechas en flujo de comisiones

  1. Nuevas Funcionalidades
    - Actualizar la fecha de inicio de tareas basada en la fecha de completado de la tarea anterior
    - Mejorar el cálculo de tiempo de gestión entre tareas
    - Asegurar que las fechas se actualicen en cascada cuando cambia la fecha de inicio del flujo

  2. Seguridad
    - Mantener las políticas RLS existentes
    - Asegurar el control de acceso adecuado
*/

-- Función para manejar la finalización de tareas y actualizar fechas de inicio de tareas siguientes
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
  -- Solo proceder si la tarea está siendo completada
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
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

-- Función para manejar cambios en el estado del flujo
CREATE OR REPLACE FUNCTION handle_flow_status_change()
RETURNS trigger AS $$
DECLARE
  v_first_task_id uuid;
  v_first_task_assignee_id uuid;
BEGIN
  -- Solo manejar cambios de pendiente a en_progreso
  IF NEW.status = 'in_progress' AND OLD.status = 'pending' THEN
    -- Obtener la primera tarea y su asignado por defecto
    SELECT t.id, t.default_assignee_id 
    INTO v_first_task_id, v_first_task_assignee_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = NEW.flow_id
    AND s."order" = 1
    AND t."order" = 1;

    -- Actualizar la primera tarea a pendiente y asignar usuario por defecto
    UPDATE commission_flow_tasks
    SET 
      status = 'pending',
      assignee_id = v_first_task_assignee_id,
      assigned_at = CASE 
        WHEN v_first_task_assignee_id IS NOT NULL THEN now()
        ELSE NULL
      END,
      started_at = NEW.started_at -- Usar la fecha de inicio del flujo
    WHERE commission_flow_id = NEW.id
    AND task_id = v_first_task_id
    AND status = 'blocked'; -- Solo actualizar si la tarea está bloqueada
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear los triggers
DROP TRIGGER IF EXISTS on_task_completion ON commission_flow_tasks;
CREATE TRIGGER on_task_completion
  AFTER UPDATE OF status ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion();

DROP TRIGGER IF EXISTS on_commission_flow_status_change ON commission_flows;
CREATE TRIGGER on_commission_flow_status_change
  AFTER UPDATE OF status ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION handle_flow_status_change();

-- Función para actualizar todas las fechas de inicio de tareas cuando cambia la fecha de inicio del flujo
CREATE OR REPLACE FUNCTION update_task_dates_on_flow_start_change()
RETURNS trigger AS $$
DECLARE
  v_first_task_id uuid;
BEGIN
  -- Solo proceder si la fecha de inicio ha cambiado
  IF NEW.started_at IS DISTINCT FROM OLD.started_at AND NEW.status = 'in_progress' THEN
    -- Obtener la primera tarea del flujo
    SELECT t.id INTO v_first_task_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = NEW.flow_id
    AND s."order" = 1
    AND t."order" = 1;

    -- Actualizar la fecha de inicio de la primera tarea
    UPDATE commission_flow_tasks
    SET started_at = NEW.started_at
    WHERE commission_flow_id = NEW.id
    AND task_id = v_first_task_id
    AND status = 'pending';
    
    -- Las demás tareas se actualizarán en cascada cuando se completen las tareas anteriores
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar fechas cuando cambia la fecha de inicio del flujo
DROP TRIGGER IF EXISTS on_flow_start_date_change ON commission_flows;
CREATE TRIGGER on_flow_start_date_change
  AFTER UPDATE OF started_at ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_task_dates_on_flow_start_change();

-- Función para manejar el cambio de estado de tareas de completado a en proceso
CREATE OR REPLACE FUNCTION handle_commission_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_is_admin boolean;
  v_flow_status text;
  v_stage_order int;
  v_task_order int;
  v_prev_task_completed boolean;
  v_prev_stage_completed boolean;
  v_default_assignee_id uuid;
BEGIN
  -- Verificar si el usuario es administrador
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  ) INTO v_is_admin;

  -- Permitir a los administradores modificar fechas directamente
  IF v_is_admin AND (
    NEW.started_at IS DISTINCT FROM OLD.started_at OR
    NEW.completed_at IS DISTINCT FROM OLD.completed_at
  ) THEN
    RETURN NEW;
  END IF;

  -- Obtener información del estado del flujo y el orden de la tarea
  SELECT 
    cf.status,
    pfs."order",
    pft."order",
    pft.default_assignee_id
  INTO 
    v_flow_status,
    v_stage_order,
    v_task_order,
    v_default_assignee_id
  FROM commission_flows cf
  JOIN payment_flow_stages pfs ON pfs.id = cf.current_stage_id
  JOIN payment_flow_tasks pft ON pft.stage_id = pfs.id AND pft.id = NEW.task_id
  WHERE cf.id = NEW.commission_flow_id;

  -- Verificar si el flujo está pendiente
  IF v_flow_status = 'pending' THEN
    RAISE EXCEPTION 'No se pueden modificar tareas mientras el flujo esté pendiente';
  END IF;

  -- Omitir validación de orden de tareas para administradores
  IF NOT v_is_admin THEN
    -- Verificar completado de tarea anterior si no es la primera tarea
    IF v_task_order > 1 THEN
      SELECT EXISTS (
        SELECT 1
        FROM commission_flow_tasks cft
        JOIN payment_flow_tasks pft ON pft.id = cft.task_id
        WHERE cft.commission_flow_id = NEW.commission_flow_id
        AND pft.stage_id = (SELECT stage_id FROM payment_flow_tasks WHERE id = NEW.task_id)
        AND pft."order" = v_task_order - 1
        AND cft.status = 'completed'
      ) INTO v_prev_task_completed;

      IF NOT v_prev_task_completed AND NEW.status != 'blocked' THEN
        RAISE EXCEPTION 'No se puede modificar esta tarea hasta que se complete la tarea anterior';
      END IF;
    END IF;

    -- Verificar completado de etapa anterior si no es la primera etapa
    IF v_stage_order > 1 THEN
      SELECT EXISTS (
        SELECT 1
        FROM commission_flow_tasks cft
        JOIN payment_flow_tasks pft ON pft.id = cft.task_id
        JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
        WHERE cft.commission_flow_id = NEW.commission_flow_id
        AND pfs."order" = v_stage_order - 1
        AND cft.status = 'completed'
      ) INTO v_prev_stage_completed;

      IF NOT v_prev_stage_completed AND NEW.status != 'blocked' THEN
        RAISE EXCEPTION 'No se puede modificar esta tarea hasta que se complete la etapa anterior';
      END IF;
    END IF;
  END IF;

  -- Si la tarea cambia de completada a en proceso, borrar la fecha de completado
  IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    NEW.completed_at = NULL;
  END IF;

  -- Establecer started_at cuando la tarea cambia de pendiente a otro estado
  IF (OLD.status = 'pending' OR OLD.status IS NULL) AND NEW.status != 'pending' THEN
    -- Mantener la fecha de inicio existente si ya está establecida
    NEW.started_at = COALESCE(NEW.started_at, now());
  END IF;

  -- Manejar completado de tarea
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar tareas completadas';
    END IF;
    NEW.completed_at = NULL;
  END IF;

  -- Asignar usuario por defecto si no está asignado
  IF NEW.assignee_id IS NULL AND v_default_assignee_id IS NOT NULL THEN
    NEW.assignee_id = v_default_assignee_id;
    NEW.assigned_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger para el cambio de estado de tareas
DROP TRIGGER IF EXISTS on_task_status_change ON commission_flow_tasks;
CREATE TRIGGER on_task_status_change
  BEFORE UPDATE ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_commission_task_status_change();