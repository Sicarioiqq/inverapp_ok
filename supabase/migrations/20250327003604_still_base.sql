/*
  # Update payment flow task status handling

  1. Changes
    - Add trigger to set initial task statuses as blocked
    - Add trigger to handle task completion and unblock next task
    - Update flow start handling to unblock first task
    - Add function to get next task in sequence

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Function to get the next task in sequence
CREATE OR REPLACE FUNCTION get_next_task(
  p_flow_id uuid,
  p_current_stage_order integer,
  p_current_task_order integer
) RETURNS TABLE (
  stage_id uuid,
  task_id uuid,
  stage_order integer,
  task_order integer
) AS $$
BEGIN
  RETURN QUERY
  WITH ordered_tasks AS (
    SELECT 
      s.id as stage_id,
      t.id as task_id,
      s."order" as stage_order,
      t."order" as task_order
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = p_flow_id
    ORDER BY s."order", t."order"
  )
  SELECT 
    ot.stage_id,
    ot.task_id,
    ot.stage_order,
    ot.task_order
  FROM ordered_tasks ot
  WHERE (ot.stage_order = p_current_stage_order AND ot.task_order > p_current_task_order)
     OR (ot.stage_order > p_current_stage_order)
  ORDER BY ot.stage_order, ot.task_order
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to handle flow initialization
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

  -- Create all tasks as blocked
  INSERT INTO commission_flow_tasks (
    commission_flow_id,
    task_id,
    status
  )
  SELECT 
    NEW.id,
    t.id,
    'blocked'
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id;

  -- If flow is started, set first task to pending
  IF NEW.status = 'in_progress' THEN
    UPDATE commission_flow_tasks
    SET status = 'pending'
    WHERE commission_flow_id = NEW.id
    AND task_id = v_first_task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle task completion
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

      -- Set next task to pending
      UPDATE commission_flow_tasks
      SET status = 'pending'
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

-- Create trigger for flow initialization
DROP TRIGGER IF EXISTS on_commission_flow_created ON commission_flows;
CREATE TRIGGER on_commission_flow_created
  AFTER INSERT ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION initialize_commission_flow();

-- Create trigger for task completion
DROP TRIGGER IF EXISTS on_task_completion ON commission_flow_tasks;
CREATE TRIGGER on_task_completion
  AFTER UPDATE OF status ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion();

-- Update existing flows to match new behavior
DO $$
DECLARE
  v_flow record;
  v_first_task_id uuid;
BEGIN
  -- For each commission flow
  FOR v_flow IN SELECT * FROM commission_flows LOOP
    -- Get first task
    SELECT t.id INTO v_first_task_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = v_flow.flow_id
    ORDER BY s."order", t."order"
    LIMIT 1;

    -- Set all tasks to blocked
    UPDATE commission_flow_tasks
    SET status = 'blocked'
    WHERE commission_flow_id = v_flow.id;

    -- If flow is in progress, set first task to pending
    IF v_flow.status = 'in_progress' THEN
      UPDATE commission_flow_tasks
      SET status = 'pending'
      WHERE commission_flow_id = v_flow.id
      AND task_id = v_first_task_id;
    END IF;
  END LOOP;
END $$;