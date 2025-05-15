/*
  # Add trigger to update next task start date when a task is completed

  1. New Functionality
    - Create a trigger to automatically set the started_at date of the next task
      to match the completed_at date of the current task
    - This ensures proper date tracking and task progression
    
  2. Changes
    - Add new trigger function to handle the date synchronization
    - Add trigger to commission_flow_tasks table
    
  3. Security
    - No changes to RLS policies required
*/

-- Create function to update next task start date
CREATE OR REPLACE FUNCTION update_next_task_start_date()
RETURNS trigger AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task_id uuid;
  v_next_task_flow_id uuid;
BEGIN
  -- Only proceed if a task's completion date is being updated
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR NEW.completed_at != OLD.completed_at) THEN
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

    -- Get next task in the same stage
    SELECT t.id INTO v_next_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow_id
    AND s."order" = v_current_stage_order
    AND t."order" = v_current_task_order + 1;
    
    -- If next task exists, update its started_at date
    IF v_next_task_id IS NOT NULL THEN
      -- Find the corresponding task in the flow
      SELECT cft.id INTO v_next_task_flow_id
      FROM commission_flow_tasks cft
      WHERE cft.commission_flow_id = NEW.commission_flow_id
      AND cft.task_id = v_next_task_id;
      
      -- If found and not already started, update its started_at date
      IF v_next_task_flow_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET started_at = NEW.completed_at
        WHERE id = v_next_task_flow_id
        AND started_at IS NULL;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task completion date change
DROP TRIGGER IF EXISTS on_task_completion_date_change ON commission_flow_tasks;
CREATE TRIGGER on_task_completion_date_change
  AFTER UPDATE OF completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_next_task_start_date();