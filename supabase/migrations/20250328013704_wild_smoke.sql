/*
  # Add automatic task assignment and flow progression

  1. Changes
    - Update handle_task_status_change to automatically assign default users
    - Update handle_task_completion to progress through stages
    - Add function to initialize first task with default assignee
    - Maintain existing security and validation
*/

-- Function to handle task status changes and assignments
CREATE OR REPLACE FUNCTION handle_task_status_change()
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
  JOIN payment_flow_tasks pft ON pft.stage_id = pfs.id AND pft.id = NEW.task_id;

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
    NEW.started_at = COALESCE(NEW.started_at, now());
  END IF;

  -- Handle task completion
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar tareas completadas';
    END IF;
    NEW.completed_at = NULL;
  END IF;

  -- Assign default user if not already assigned
  IF NEW.assignee_id IS NULL AND v_default_assignee_id IS NOT NULL THEN
    NEW.assignee_id = v_default_assignee_id;
    NEW.assigned_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle task completion and progression
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
  -- Only proceed if task is being completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
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
          WHEN v_next_task.default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END,
        started_at = NULL,
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
          completed_at = now()
        WHERE id = NEW.commission_flow_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to initialize commission flow with default assignees
CREATE OR REPLACE FUNCTION initialize_commission_flow()
RETURNS trigger AS $$
DECLARE
  v_first_task_id uuid;
  v_first_task_assignee_id uuid;
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

  -- Get first task of the flow and its default assignee
  SELECT t.id, t.default_assignee_id 
  INTO v_first_task_id, v_first_task_assignee_id
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ORDER BY s."order", t."order"
  LIMIT 1;

  -- Insert all tasks with proper status and assignments
  INSERT INTO commission_flow_tasks (
    commission_flow_id,
    task_id,
    status,
    started_at,
    completed_at,
    assigned_at,
    assignee_id
  )
  SELECT 
    NEW.id,
    t.id,
    CASE 
      WHEN NEW.status = 'in_progress' AND t.id = v_first_task_id THEN 'pending'
      ELSE 'blocked'
    END,
    NULL,
    NULL,
    CASE 
      WHEN NEW.status = 'in_progress' AND t.id = v_first_task_id AND t.default_assignee_id IS NOT NULL 
      THEN now()
      ELSE NULL
    END,
    CASE 
      WHEN NEW.status = 'in_progress' AND t.id = v_first_task_id 
      THEN t.default_assignee_id
      ELSE NULL
    END
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ORDER BY s."order", t."order";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
DROP TRIGGER IF EXISTS on_task_completion ON commission_flow_tasks;
CREATE TRIGGER on_task_completion
  AFTER UPDATE OF status ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion();

DROP TRIGGER IF EXISTS on_task_status_change ON commission_flow_tasks;
CREATE TRIGGER on_task_status_change
  BEFORE UPDATE ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_status_change();

DROP TRIGGER IF EXISTS on_commission_flow_created ON commission_flows;
CREATE TRIGGER on_commission_flow_created
  AFTER INSERT ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION initialize_commission_flow();