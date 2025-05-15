/*
  # Fix commission flow task creation and handling

  1. Changes
    - Add ON CONFLICT clause to handle duplicate tasks
    - Update task status and dates on conflict
    - Ensure proper task initialization
    - Fix task completion handling

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Update initialize_commission_flow function to handle duplicates
CREATE OR REPLACE FUNCTION initialize_commission_flow()
RETURNS trigger AS $$
DECLARE
  v_first_task_id uuid;
BEGIN
  -- Get first task of the flow
  SELECT t.id INTO v_first_task_id
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ORDER BY s."order", t."order"
  LIMIT 1;

  -- Create all tasks as blocked, handling duplicates
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
    NULL,
    NULL
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ON CONFLICT (commission_flow_id, task_id) 
  DO UPDATE SET 
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at,
    assigned_at = EXCLUDED.assigned_at,
    assignee_id = EXCLUDED.assignee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update handle_task_completion function to handle duplicates
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS trigger AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task record;
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

    -- If there is a next task, unblock it
    IF v_next_task IS NOT NULL THEN
      -- Update flow's current stage if needed
      IF v_next_task.stage_order > v_current_stage_order THEN
        UPDATE commission_flows
        SET current_stage_id = v_next_task.stage_id
        WHERE id = NEW.commission_flow_id;
      END IF;

      -- Set next task to pending, handling duplicates
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        started_at = NULL,
        completed_at = NULL
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

-- Create trigger for task completion if it doesn't exist
DROP TRIGGER IF EXISTS on_task_completion ON commission_flow_tasks;
CREATE TRIGGER on_task_completion
  AFTER UPDATE OF status ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion();

-- Create trigger for flow initialization if it doesn't exist
DROP TRIGGER IF EXISTS on_commission_flow_created ON commission_flows;
CREATE TRIGGER on_commission_flow_created
  AFTER INSERT ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION initialize_commission_flow();