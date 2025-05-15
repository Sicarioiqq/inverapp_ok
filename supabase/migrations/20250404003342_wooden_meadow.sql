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

-- Update initialize_commission_flow function to use Chile timezone
CREATE OR REPLACE FUNCTION initialize_commission_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_task record;
  v_existing_task_count integer;
BEGIN
  -- First check if tasks already exist for this flow
  SELECT COUNT(*) INTO v_existing_task_count
  FROM commission_flow_tasks
  WHERE commission_flow_id = NEW.id;

  -- If tasks already exist, exit early
  IF v_existing_task_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Insert all tasks with proper status, assignments and default assignees
  FOR v_task IN (
    SELECT 
      t.id as task_id,
      t.default_assignee_id,
      s."order" as stage_order,
      t."order" as task_order,
      s.id as stage_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = NEW.flow_id
    ORDER BY s."order", t."order"
  ) LOOP
    -- Insert the task
    INSERT INTO commission_flow_tasks (
      commission_flow_id,
      task_id,
      status,
      started_at,
      completed_at,
      assigned_at,
      assignee_id
    )
    VALUES (
      NEW.id,
      v_task.task_id,
      CASE 
        WHEN NEW.status = 'in_progress' AND v_task.stage_order = 1 AND v_task.task_order = 1 THEN 'pending'
        ELSE 'blocked'
      END,
      CASE
        WHEN NEW.status = 'in_progress' AND v_task.stage_order = 1 AND v_task.task_order = 1 THEN NEW.started_at
        ELSE NULL
      END,
      NULL,
      CASE 
        WHEN NEW.status = 'in_progress' AND v_task.stage_order = 1 AND v_task.task_order = 1 AND v_task.default_assignee_id IS NOT NULL 
        THEN now_chile()
        ELSE NULL
      END,
      CASE 
        WHEN NEW.status = 'in_progress' AND v_task.stage_order = 1 AND v_task.task_order = 1 
        THEN v_task.default_assignee_id
        ELSE NULL
      END
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update handle_flow_status_change function to use Chile timezone
CREATE OR REPLACE FUNCTION handle_flow_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_first_task_id uuid;
  v_first_task_assignee_id uuid;
BEGIN
  -- Only handle changes from pending to in_progress
  IF NEW.status = 'in_progress' AND OLD.status = 'pending' THEN
    -- Get first task and its default assignee
    SELECT t.id, t.default_assignee_id 
    INTO v_first_task_id, v_first_task_assignee_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = NEW.flow_id
    AND s."order" = 1
    AND t."order" = 1;

    -- Update first task to pending and assign default user
    UPDATE commission_flow_tasks
    SET 
      status = 'pending',
      assignee_id = v_first_task_assignee_id,
      assigned_at = CASE 
        WHEN v_first_task_assignee_id IS NOT NULL THEN now_chile()
        ELSE NULL
      END
    WHERE commission_flow_id = NEW.id
    AND task_id = v_first_task_id
    AND status = 'blocked'; -- Only update if task is blocked
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update update_task_dates_on_flow_start_change function to use Chile timezone
CREATE OR REPLACE FUNCTION update_task_dates_on_flow_start_change()
RETURNS TRIGGER AS $$
DECLARE
  v_solicitud_liquidacion_task_id uuid;
  v_solicitud_liquidacion_flow_task_id uuid;
  v_solicitud_liquidacion_status text;
BEGIN
  -- Only proceed if the start date has changed
  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    -- Get Solicitud Liquidación task ID
    SELECT t.id INTO v_solicitud_liquidacion_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = NEW.flow_id
    AND s.name = 'Solicitud Liquidación'
    AND t.name = 'Solicitud Liquidación';
    
    -- Get commission_flow_task ID and status for Solicitud Liquidación
    SELECT id, status 
    INTO v_solicitud_liquidacion_flow_task_id, v_solicitud_liquidacion_status
    FROM commission_flow_tasks
    WHERE commission_flow_id = NEW.id
    AND task_id = v_solicitud_liquidacion_task_id;
    
    -- If task exists, update its start date directly
    IF v_solicitud_liquidacion_flow_task_id IS NOT NULL THEN
      -- Update the task
      UPDATE commission_flow_tasks
      SET 
        started_at = NEW.started_at,
        status = CASE 
          WHEN status = 'blocked' AND NEW.status = 'in_progress' THEN 'pending'
          ELSE status
        END
      WHERE id = v_solicitud_liquidacion_flow_task_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update update_next_task_start_date function to use Chile timezone
CREATE OR REPLACE FUNCTION update_next_task_start_date()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task record;
BEGIN
  -- Only proceed if the completion date has changed and the task is completed
  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at AND NEW.status = 'completed' THEN
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

    -- Get next task in the same stage
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

    -- If there is a next task, update its start date
    IF v_next_task IS NOT NULL THEN
      UPDATE commission_flow_tasks
      SET started_at = NEW.completed_at
      WHERE id = v_next_task.task_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update normalize_reservation_dates function to use Chile timezone
CREATE OR REPLACE FUNCTION normalize_reservation_dates()
RETURNS trigger AS $$
BEGIN
  -- Ensure reservation_date is stored as UTC date
  IF NEW.reservation_date IS NOT NULL THEN
    NEW.reservation_date := to_chile_timezone(NEW.reservation_date::date);
  END IF;
  
  -- Ensure promise_date is stored as UTC date
  IF NEW.promise_date IS NOT NULL THEN
    NEW.promise_date := to_chile_timezone(NEW.promise_date::date);
  END IF;
  
  -- Ensure deed_date is stored as UTC date
  IF NEW.deed_date IS NOT NULL THEN
    NEW.deed_date := to_chile_timezone(NEW.deed_date::date);
  END IF;
  
  -- Ensure commission_payment_month is stored as UTC date (first day of month)
  IF NEW.commission_payment_month IS NOT NULL THEN
    -- Extract year and month, then set day to 1
    NEW.commission_payment_month := to_chile_timezone(date_trunc('month', NEW.commission_payment_month::date)::date);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;