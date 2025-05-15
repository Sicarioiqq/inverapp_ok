-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Create a function to handle timezone conversion for Chile
CREATE OR REPLACE FUNCTION to_chile_timezone(utc_timestamp timestamptz) 
RETURNS timestamptz AS $$
BEGIN
  RETURN utc_timestamp AT TIME ZONE 'America/Santiago';
END;
$$ LANGUAGE plpgsql;

-- Create a function to get current time in Chile timezone
CREATE OR REPLACE FUNCTION now_chile() 
RETURNS timestamptz AS $$
BEGIN
  RETURN now() AT TIME ZONE 'America/Santiago';
END;
$$ LANGUAGE plpgsql;

-- Update handle_task_status_change function to use Chile timezone
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
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  ) INTO v_is_admin;

  -- Allow admins to modify dates directly
  IF v_is_admin AND (
    NEW.started_at IS DISTINCT FROM OLD.started_at OR
    NEW.completed_at IS DISTINCT FROM OLD.completed_at
  ) THEN
    RETURN NEW;
  END IF;

  -- Get flow status and task order information
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

  -- Check if flow is pending
  IF v_flow_status = 'pending' THEN
    RAISE EXCEPTION 'No se pueden modificar tareas mientras el flujo esté pendiente';
  END IF;

  -- Skip task order validation for admins
  IF NOT v_is_admin THEN
    -- Check previous task completion if not first task
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

    -- Check previous stage completion if not first stage
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

  -- Set started_at when task is first assigned or status changes from pending
  IF (OLD.status = 'pending' OR OLD.status IS NULL) AND NEW.status != 'pending' THEN
    NEW.started_at = COALESCE(NEW.started_at, now_chile());
  END IF;

  -- Handle task completion
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now_chile());
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar tareas completadas';
    END IF;
    NEW.completed_at = NULL;
  END IF;

  -- Assign default user if not already assigned
  IF NEW.assignee_id IS NULL AND v_default_assignee_id IS NOT NULL THEN
    NEW.assignee_id = v_default_assignee_id;
    NEW.assigned_at = now_chile();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update handle_task_completion function to use Chile timezone
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task record;
  v_is_last_task boolean;
  v_all_tasks_completed boolean;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get current task position and flow ID
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

    -- Get next task with default assignee
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

    -- If there is a next task, set it up
    IF v_next_task IS NOT NULL THEN
      -- Update flow's current stage if needed
      IF v_next_task.stage_order > v_current_stage_order THEN
        UPDATE commission_flows
        SET current_stage_id = v_next_task.stage_id
        WHERE id = NEW.commission_flow_id;
      END IF;

      -- Set next task to pending and assign default user
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        assignee_id = v_next_task.default_assignee_id,
        assigned_at = CASE 
          WHEN v_next_task.default_assignee_id IS NOT NULL THEN now_chile()
          ELSE NULL
        END,
        started_at = NEW.completed_at, -- Use the completion date of the current task as the start date
        completed_at = NULL
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_next_task.task_id;

    ELSE
      -- Check if this is the last task
      SELECT is_last_payment_task(NEW.task_id) INTO v_is_last_task;
      
      -- Check if all tasks are completed
      SELECT NOT EXISTS (
        SELECT 1 
        FROM commission_flow_tasks 
        WHERE commission_flow_id = NEW.commission_flow_id 
        AND status != 'completed'
      ) INTO v_all_tasks_completed;

      -- If this is the last task and all tasks are completed, complete the flow
      IF v_is_last_task AND v_all_tasks_completed THEN
        UPDATE commission_flows
        SET 
          status = 'completed',
          completed_at = now_chile()
        WHERE id = NEW.commission_flow_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update handle_task_status_change function for reservation_flow_tasks to use Chile timezone
CREATE OR REPLACE FUNCTION handle_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  ) INTO v_is_admin;

  -- Task being completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Set completion date
    NEW.completed_at = now_chile();
    
    -- Clear assignee when task is completed
    NEW.assignee_id = NULL;
    
    -- Remove all task assignments
    DELETE FROM task_assignments
    WHERE reservation_flow_id = NEW.reservation_flow_id
    AND task_id = NEW.task_id;
  
  -- Task being uncompleted
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar tareas completadas';
    END IF;
    NEW.completed_at = NULL;
  
  -- Completed date being modified directly
  ELSIF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar la fecha de completado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to handle Solicitud a Jefe Inversiones completion
CREATE OR REPLACE FUNCTION handle_solicitud_jefe_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_jefe_task_id uuid;
  v_vb_jefe_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is Solicitud a Jefe Inversiones task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Aprobación Jefe Inversiones'
      AND t.name = 'Solicitud a Jefe Inversiones'
    ) THEN
      -- Get VB Jefe Inversiones task ID
      SELECT t.id INTO v_vb_jefe_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Aprobación Jefe Inversiones'
      AND t.name = 'VB Jefe Inversiones';
      
      -- Get commission_flow_task ID for VB Jefe Inversiones
      SELECT id INTO v_vb_jefe_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_vb_jefe_task_id;
      
      -- If task exists, update its start date and status
      IF v_vb_jefe_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = 'pending'
        WHERE id = v_vb_jefe_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for Solicitud a Jefe Inversiones completion
DROP TRIGGER IF EXISTS on_solicitud_jefe_completion ON commission_flow_tasks;
CREATE TRIGGER on_solicitud_jefe_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_solicitud_jefe_completion();

-- Fix existing task dates for in-progress flows
DO $$
DECLARE
  v_flow record;
  v_solicitud_jefe_task_id uuid;
  v_solicitud_jefe_flow_task_id uuid;
  v_solicitud_jefe_completed_at timestamptz;
  v_solicitud_jefe_status text;
  v_vb_jefe_task_id uuid;
  v_vb_jefe_flow_task_id uuid;
BEGIN
  -- For each commission flow
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Get Solicitud a Jefe Inversiones task
    SELECT pft.id, cft.id, cft.completed_at, cft.status
    INTO v_solicitud_jefe_task_id, v_solicitud_jefe_flow_task_id, v_solicitud_jefe_completed_at, v_solicitud_jefe_status
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Aprobación Jefe Inversiones'
    AND pft.name = 'Solicitud a Jefe Inversiones';
    
    -- Get VB Jefe Inversiones task
    SELECT pft.id, cft.id 
    INTO v_vb_jefe_task_id, v_vb_jefe_flow_task_id
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Aprobación Jefe Inversiones'
    AND pft.name = 'VB Jefe Inversiones';
    
    -- If Solicitud a Jefe Inversiones is completed, update VB Jefe Inversiones
    IF v_solicitud_jefe_status = 'completed' AND v_solicitud_jefe_completed_at IS NOT NULL AND v_vb_jefe_flow_task_id IS NOT NULL THEN
      -- Update the task directly (trigger is disabled)
      UPDATE commission_flow_tasks
      SET 
        started_at = v_solicitud_jefe_completed_at,
        status = 'pending'
      WHERE id = v_vb_jefe_flow_task_id;
    -- If Solicitud a Jefe Inversiones is not completed, ensure VB Jefe Inversiones is blocked
    ELSIF v_solicitud_jefe_status != 'completed' AND v_vb_jefe_flow_task_id IS NOT NULL THEN
      -- Update the task directly (trigger is disabled)
      UPDATE commission_flow_tasks
      SET 
        status = 'blocked',
        started_at = NULL
      WHERE id = v_vb_jefe_flow_task_id;
    END IF;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;