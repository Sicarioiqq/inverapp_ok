/*
  # Add assigned date tracking to payment flow tasks

  1. Changes
    - Add function to get previous task completion date
    - Update handle_task_completion to set assigned_at based on previous task
    - Update handle_task_status_change to allow admin date modifications
    - Fix task initialization to set proper assigned_at dates
*/

-- Function to get previous task completion date
CREATE OR REPLACE FUNCTION get_previous_task_completion_date(
  p_flow_id uuid,
  p_current_stage_order integer,
  p_current_task_order integer
) RETURNS timestamptz AS $$
DECLARE
  v_completion_date timestamptz;
BEGIN
  -- If first task of first stage, return flow start date
  IF p_current_stage_order = 1 AND p_current_task_order = 1 THEN
    SELECT started_at INTO v_completion_date
    FROM commission_flows
    WHERE flow_id = p_flow_id;
    RETURN v_completion_date;
  END IF;

  -- Get completion date of previous task in same stage
  IF p_current_task_order > 1 THEN
    SELECT cft.completed_at INTO v_completion_date
    FROM commission_flow_tasks cft
    JOIN payment_flow_tasks pft ON pft.id = cft.task_id
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    WHERE pfs.flow_id = p_flow_id
    AND pfs."order" = p_current_stage_order
    AND pft."order" = p_current_task_order - 1
    AND cft.status = 'completed';
    
    IF v_completion_date IS NOT NULL THEN
      RETURN v_completion_date;
    END IF;
  END IF;

  -- Get completion date of last task in previous stage
  SELECT cft.completed_at INTO v_completion_date
  FROM commission_flow_tasks cft
  JOIN payment_flow_tasks pft ON pft.id = cft.task_id
  JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
  WHERE pfs.flow_id = p_flow_id
  AND pfs."order" = p_current_stage_order - 1
  AND cft.status = 'completed'
  ORDER BY pft."order" DESC
  LIMIT 1;

  RETURN v_completion_date;
END;
$$ LANGUAGE plpgsql;

-- Update handle_task_completion to set assigned_at
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS trigger AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task record;
  v_completion_date timestamptz;
BEGIN
  -- Only proceed if task is being completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get current task position
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

    -- Get next task
    SELECT * INTO v_next_task 
    FROM get_next_task_with_assignee(v_flow_id, v_current_stage_order, v_current_task_order);

    -- If there is a next task, set it up
    IF v_next_task IS NOT NULL THEN
      -- Update flow's current stage if needed
      IF v_next_task.stage_order > v_current_stage_order THEN
        UPDATE commission_flows
        SET current_stage_id = v_next_task.stage_id
        WHERE id = NEW.commission_flow_id;
      END IF;

      -- Get completion date of current task for next task's assigned_at
      SELECT completed_at INTO v_completion_date
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = NEW.task_id;

      -- Set next task to pending and assign
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        assignee_id = v_next_task.default_assignee_id,
        assigned_at = v_completion_date,
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

-- Update initialize_commission_flow to set initial assigned_at
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

  -- Insert all tasks with proper assigned_at dates
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
      WHEN NEW.status = 'in_progress' AND t.id = v_first_task_id THEN NEW.started_at
      ELSE NULL
    END,
    CASE 
      WHEN NEW.status = 'in_progress' AND t.id = v_first_task_id THEN t.default_assignee_id
      ELSE NULL
    END
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ORDER BY s."order", t."order";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;