/*
  # Fix payment flow automation and task progression

  1. Changes
    - Update flow initialization to properly assign first task
    - Fix task progression and automatic assignments
    - Ensure proper task status changes
    - Add proper task blocking/unblocking logic
    - Handle completed tasks correctly
*/

-- Function to handle flow status changes (starting flow)
CREATE OR REPLACE FUNCTION handle_flow_status_change()
RETURNS trigger AS $$
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
        WHEN v_first_task_assignee_id IS NOT NULL THEN now()
        ELSE NULL
      END
    WHERE commission_flow_id = NEW.id
    AND task_id = v_first_task_id
    AND status = 'blocked'; -- Only update if task is blocked
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
        END
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_next_task.task_id
      AND status = 'blocked'; -- Only update if task is blocked

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

-- Function to initialize commission flow with proper task setup
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
  AND s."order" = 1
  AND t."order" = 1;

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

DROP TRIGGER IF EXISTS on_commission_flow_status_change ON commission_flows;
CREATE TRIGGER on_commission_flow_status_change
  AFTER UPDATE OF status ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION handle_flow_status_change();

DROP TRIGGER IF EXISTS on_commission_flow_created ON commission_flows;
CREATE TRIGGER on_commission_flow_created
  AFTER INSERT ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION initialize_commission_flow();

-- Reset only non-completed tasks in existing flows
DO $$
DECLARE
  v_flow record;
  v_first_task_id uuid;
  v_first_task_assignee_id uuid;
BEGIN
  -- For each in_progress flow
  FOR v_flow IN 
    SELECT * FROM commission_flows 
    WHERE status = 'in_progress'
  LOOP
    -- Get first task info
    SELECT t.id, t.default_assignee_id 
    INTO v_first_task_id, v_first_task_assignee_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = v_flow.flow_id
    AND s."order" = 1
    AND t."order" = 1;

    -- Reset only non-completed tasks to blocked
    UPDATE commission_flow_tasks
    SET 
      status = 'blocked',
      assignee_id = NULL,
      assigned_at = NULL,
      started_at = NULL,
      completed_at = NULL
    WHERE commission_flow_id = v_flow.id
    AND status != 'completed';

    -- Set first task to pending with default assignee if not completed
    UPDATE commission_flow_tasks
    SET 
      status = 'pending',
      assignee_id = v_first_task_assignee_id,
      assigned_at = CASE 
        WHEN v_first_task_assignee_id IS NOT NULL THEN now()
        ELSE NULL
      END
    WHERE commission_flow_id = v_flow.id
    AND task_id = v_first_task_id
    AND status != 'completed';
  END LOOP;
END $$;