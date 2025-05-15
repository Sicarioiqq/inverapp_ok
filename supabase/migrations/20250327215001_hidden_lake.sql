/*
  # Add automatic task assignment and stage progression

  1. Changes
    - Update handle_task_completion to automatically:
      - Assign default user to next task
      - Set next task to pending
    - Add function to get next task with default assignee
    - Maintain existing completion logic
*/

-- Create function to get next task with default assignee
CREATE OR REPLACE FUNCTION get_next_task_with_assignee(
  p_flow_id uuid,
  p_current_stage_order integer,
  p_current_task_order integer
) RETURNS TABLE (
  stage_id uuid,
  task_id uuid,
  stage_order integer,
  task_order integer,
  default_assignee_id uuid
) AS $$
BEGIN
  RETURN QUERY
  WITH ordered_tasks AS (
    SELECT 
      s.id as stage_id,
      t.id as task_id,
      s."order" as stage_order,
      t."order" as task_order,
      t.default_assignee_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = p_flow_id
    ORDER BY s."order", t."order"
  )
  SELECT 
    ot.stage_id,
    ot.task_id,
    ot.stage_order,
    ot.task_order,
    ot.default_assignee_id
  FROM ordered_tasks ot
  WHERE (ot.stage_order = p_current_stage_order AND ot.task_order > p_current_task_order)
     OR (ot.stage_order > p_current_stage_order)
  ORDER BY ot.stage_order, ot.task_order
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Update handle_task_completion function
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
    SELECT * INTO v_next_task 
    FROM get_next_task_with_assignee(v_flow_id, v_current_stage_order, v_current_task_order);

    -- Check if current task is the last one
    SELECT is_last_payment_task(NEW.task_id) INTO v_is_last_task;
    
    -- Check if all tasks are completed
    SELECT NOT EXISTS (
      SELECT 1 
      FROM commission_flow_tasks 
      WHERE commission_flow_id = NEW.commission_flow_id 
      AND task_id != COALESCE(v_next_task.task_id, NULL)
      AND status != 'completed'
    ) INTO v_all_tasks_completed;

    -- If there is a next task, set it up
    IF v_next_task IS NOT NULL THEN
      -- Update flow's current stage if needed
      IF v_next_task.stage_order > v_current_stage_order THEN
        UPDATE commission_flows
        SET current_stage_id = v_next_task.stage_id
        WHERE id = NEW.commission_flow_id;
      END IF;

      -- Set next task to pending and assign default user if configured
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        assignee_id = v_next_task.default_assignee_id,
        assigned_at = CASE 
          WHEN v_next_task.default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_next_task.task_id;

    -- If this is the last task and all tasks are completed, complete the flow
    ELSIF v_is_last_task AND v_all_tasks_completed THEN
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

-- Recreate trigger
DROP TRIGGER IF EXISTS on_task_completion ON commission_flow_tasks;
CREATE TRIGGER on_task_completion
  AFTER UPDATE OF status ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion();

-- Fix any tasks that should be pending with default assignees
DO $$
DECLARE
  v_flow record;
  v_next_task record;
BEGIN
  FOR v_flow IN 
    SELECT 
      cf.*,
      pfs."order" as current_stage_order,
      pft."order" as current_task_order
    FROM commission_flows cf
    JOIN payment_flow_stages pfs ON pfs.id = cf.current_stage_id
    JOIN commission_flow_tasks cft ON cft.commission_flow_id = cf.id
    JOIN payment_flow_tasks pft ON pft.id = cft.task_id
    WHERE cf.status = 'in_progress'
    AND cft.status = 'completed'
  LOOP
    -- Get next task that should be pending
    SELECT * INTO v_next_task 
    FROM get_next_task_with_assignee(
      v_flow.flow_id, 
      v_flow.current_stage_order, 
      v_flow.current_task_order
    );

    -- If found, update it
    IF v_next_task IS NOT NULL THEN
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        assignee_id = v_next_task.default_assignee_id,
        assigned_at = CASE 
          WHEN v_next_task.default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END
      WHERE commission_flow_id = v_flow.id
      AND task_id = v_next_task.task_id
      AND status = 'blocked';
    END IF;
  END LOOP;
END $$;