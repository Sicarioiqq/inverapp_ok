/*
  # Fix payment flow automation and task initialization

  1. Changes
    - Update initialize_commission_flow to properly set first task status and assignee
    - Fix task status handling when flow starts
    - Ensure proper task progression and assignment
    - Reset existing flows to correct state
*/

-- Update initialize_commission_flow to properly handle task creation and assignment
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

-- Function to handle flow status changes
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
    ORDER BY s."order", t."order"
    LIMIT 1;

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
    AND task_id = v_first_task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for flow status changes
DROP TRIGGER IF EXISTS on_commission_flow_status_change ON commission_flows;
CREATE TRIGGER on_commission_flow_status_change
  AFTER UPDATE OF status ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION handle_flow_status_change();

-- Reset all existing flows to ensure proper state
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
    ORDER BY s."order", t."order"
    LIMIT 1;

    -- Reset all tasks to blocked
    UPDATE commission_flow_tasks
    SET 
      status = 'blocked',
      assignee_id = NULL,
      assigned_at = NULL,
      started_at = NULL,
      completed_at = NULL
    WHERE commission_flow_id = v_flow.id;

    -- Set first task to pending with default assignee
    UPDATE commission_flow_tasks
    SET 
      status = 'pending',
      assignee_id = v_first_task_assignee_id,
      assigned_at = CASE 
        WHEN v_first_task_assignee_id IS NOT NULL THEN now()
        ELSE NULL
      END
    WHERE commission_flow_id = v_flow.id
    AND task_id = v_first_task_id;
  END LOOP;
END $$;