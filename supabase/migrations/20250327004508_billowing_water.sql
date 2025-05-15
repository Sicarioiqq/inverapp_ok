/*
  # Fix commission flow task initialization

  1. Changes
    - Update initialize_commission_flow function to handle task creation
    - Set all tasks to blocked by default
    - Only set first task to pending when flow starts
    - Add proper error handling for duplicates
    
  2. Security
    - Maintain existing RLS policies
*/

-- Update initialize_commission_flow function to handle task creation properly
CREATE OR REPLACE FUNCTION initialize_commission_flow()
RETURNS trigger AS $$
DECLARE
  v_first_task_id uuid;
  v_task record;
BEGIN
  -- Get first task of the flow
  SELECT t.id INTO v_first_task_id
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ORDER BY s."order", t."order"
  LIMIT 1;

  -- Create tasks one by one to handle duplicates properly
  FOR v_task IN (
    SELECT t.id as task_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = NEW.flow_id
    ORDER BY s."order", t."order"
  )
  LOOP
    -- Try to insert the task
    BEGIN
      INSERT INTO commission_flow_tasks (
        commission_flow_id,
        task_id,
        status,
        started_at,
        completed_at,
        assigned_at,
        assignee_id
      )
      VALUES (
        NEW.id,
        v_task.task_id,
        CASE 
          WHEN NEW.status = 'in_progress' AND v_task.task_id = v_first_task_id THEN 'pending'
          ELSE 'blocked'
        END,
        NULL,
        NULL,
        NULL,
        NULL
      );
    EXCEPTION 
      WHEN unique_violation THEN
        -- If task already exists, update it instead
        UPDATE commission_flow_tasks
        SET 
          status = CASE 
            WHEN NEW.status = 'in_progress' AND v_task.task_id = v_first_task_id THEN 'pending'
            ELSE 'blocked'
          END,
          started_at = NULL,
          completed_at = NULL,
          assigned_at = NULL,
          assignee_id = NULL
        WHERE commission_flow_id = NEW.id
        AND task_id = v_task.task_id;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_commission_flow_created ON commission_flows;
CREATE TRIGGER on_commission_flow_created
  AFTER INSERT ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION initialize_commission_flow();

-- Reset all existing commission flow tasks to blocked state
UPDATE commission_flow_tasks cft
SET 
  status = CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM commission_flows cf
      JOIN payment_flow_stages s ON s.id = cf.current_stage_id
      JOIN payment_flow_tasks t ON t.stage_id = s.id
      WHERE cf.id = cft.commission_flow_id
      AND t.id = cft.task_id
      AND s."order" = 1
      AND t."order" = 1
      AND cf.status = 'in_progress'
    ) THEN 'pending'
    ELSE 'blocked'
  END,
  started_at = NULL,
  completed_at = NULL,
  assigned_at = NULL,
  assignee_id = NULL;