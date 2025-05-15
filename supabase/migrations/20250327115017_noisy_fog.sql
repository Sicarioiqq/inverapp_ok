/*
  # Add automatic task assignment and status update

  1. Changes
    - Update handle_task_completion function to:
      - Set next task to pending automatically
      - Assign default user if configured
    - Maintain existing task dependencies and flow logic
    - Handle edge cases properly

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity
*/

-- Update handle_task_completion function to handle automatic assignment
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS trigger AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task record;
  v_default_assignee_id uuid;
BEGIN
  -- Only proceed if task is being completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get current task position
    SELECT 
      f.id as flow_id,
      s."order" as stage_order,
      t."order" as task_order
    INTO v_flow_id, v_current_stage_order, v_current_task_order
    FROM commission_flows f
    JOIN payment_flow_stages s ON s.id = f.current_stage_id
    JOIN payment_flow_tasks t ON t.id = NEW.task_id
    WHERE f.id = NEW.commission_flow_id;

    -- Get next task
    SELECT * INTO v_next_task 
    FROM get_next_task(v_flow_id, v_current_stage_order, v_current_task_order);

    -- If there is a next task, unblock it and set up
    IF v_next_task IS NOT NULL THEN
      -- Update flow's current stage if needed
      IF v_next_task.stage_order > v_current_stage_order THEN
        UPDATE commission_flows
        SET current_stage_id = v_next_task.stage_id
        WHERE id = NEW.commission_flow_id;
      END IF;

      -- Get default assignee for next task
      SELECT default_assignee_id INTO v_default_assignee_id
      FROM payment_flow_tasks
      WHERE id = v_next_task.task_id;

      -- Set next task to pending and assign default user if configured
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        assignee_id = v_default_assignee_id,
        assigned_at = CASE 
          WHEN v_default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_next_task.task_id;

    ELSE
      -- If no next task, complete the flow
      UPDATE commission_flows
      SET 
        status = 'completed',
        completed_at = now()
      WHERE id = NEW.commission_flow_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update initialize_commission_flow function to handle initial task setup
CREATE OR REPLACE FUNCTION initialize_commission_flow()
RETURNS trigger AS $$
DECLARE
  v_first_task_id uuid;
  v_default_assignee_id uuid;
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

  -- Get first task of the flow
  SELECT t.id, t.default_assignee_id 
  INTO v_first_task_id, v_default_assignee_id
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ORDER BY s."order", t."order"
  LIMIT 1;

  -- Insert all tasks at once with proper status
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
  ON CONFLICT (commission_flow_id, task_id) DO UPDATE SET
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at,
    assigned_at = EXCLUDED.assigned_at,
    assignee_id = EXCLUDED.assignee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
DROP TRIGGER IF EXISTS on_task_completion ON commission_flow_tasks;
CREATE TRIGGER on_task_completion
  AFTER UPDATE OF status ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion();

DROP TRIGGER IF EXISTS on_commission_flow_created ON commission_flows;
CREATE TRIGGER on_commission_flow_created
  AFTER INSERT ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION initialize_commission_flow();

-- Fix any existing tasks that should be pending with default assignees
DO $$
DECLARE
  v_flow record;
  v_first_task record;
BEGIN
  FOR v_flow IN 
    SELECT cf.* 
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Get first task info
    SELECT 
      t.id as task_id,
      t.default_assignee_id
    INTO v_first_task
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = v_flow.flow_id
    AND s.id = v_flow.current_stage_id
    ORDER BY s."order", t."order"
    LIMIT 1;

    -- Update first task if it exists
    IF v_first_task IS NOT NULL THEN
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        assignee_id = v_first_task.default_assignee_id,
        assigned_at = CASE 
          WHEN v_first_task.default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END
      WHERE commission_flow_id = v_flow.id
      AND task_id = v_first_task.task_id
      AND status = 'blocked';
    END IF;
  END LOOP;
END $$;