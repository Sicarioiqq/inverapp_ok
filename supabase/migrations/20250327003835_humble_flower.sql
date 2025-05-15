/*
  # Fix commission flow task creation

  1. Changes
    - Add ON CONFLICT clause to handle duplicate tasks
    - Update existing task status instead of creating new one
    - Maintain task relationships and data integrity

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
    status
  )
  SELECT 
    NEW.id,
    t.id,
    'blocked'
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ON CONFLICT (commission_flow_id, task_id) 
  DO UPDATE SET 
    status = EXCLUDED.status,
    started_at = NULL,
    completed_at = NULL,
    assigned_at = NULL,
    assignee_id = NULL;

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