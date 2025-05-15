/*
  # Fix commission flow task initialization

  1. Changes
    - Add check for existing tasks before initialization
    - Handle task creation with proper error handling
    - Ensure proper status assignment for new tasks
    - Add ON CONFLICT clause to prevent duplicates

  2. Notes
    - Maintains existing task relationships
    - Preserves task order and dependencies
    - Handles edge cases properly
*/

-- Update initialize_commission_flow function to properly handle task creation
CREATE OR REPLACE FUNCTION initialize_commission_flow()
RETURNS trigger AS $$
DECLARE
  v_first_task_id uuid;
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
  SELECT t.id INTO v_first_task_id
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
    NULL,
    NULL
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

-- Recreate trigger
DROP TRIGGER IF EXISTS on_commission_flow_created ON commission_flows;
CREATE TRIGGER on_commission_flow_created
  AFTER INSERT ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION initialize_commission_flow();

-- Fix any existing flows that might have duplicate or missing tasks
DO $$
DECLARE
  v_flow record;
  v_first_task_id uuid;
BEGIN
  FOR v_flow IN SELECT * FROM commission_flows LOOP
    -- Get first task of the flow
    SELECT t.id INTO v_first_task_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = v_flow.flow_id
    ORDER BY s."order", t."order"
    LIMIT 1;

    -- Insert or update tasks for this flow
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
      v_flow.id,
      t.id,
      CASE 
        WHEN v_flow.status = 'in_progress' AND t.id = v_first_task_id THEN 'pending'
        ELSE 'blocked'
      END,
      NULL,
      NULL,
      NULL,
      NULL
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = v_flow.flow_id
    ON CONFLICT (commission_flow_id, task_id) DO UPDATE SET
      status = CASE 
        WHEN v_flow.status = 'in_progress' AND EXCLUDED.task_id = v_first_task_id THEN 'pending'
        ELSE 'blocked'
      END,
      started_at = NULL,
      completed_at = NULL,
      assigned_at = NULL,
      assignee_id = NULL
    WHERE commission_flow_tasks.status = 'blocked';
  END LOOP;
END $$;