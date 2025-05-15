-- Fix task assignments table and related functions

-- Drop and recreate handle_task_assignment function to ensure it only uses reservation_flow_id
CREATE OR REPLACE FUNCTION handle_task_assignment()
RETURNS trigger AS $$
BEGIN
  -- Update assigned_at and assignee_id in reservation_flow_tasks when a user is assigned
  UPDATE reservation_flow_tasks
  SET 
    assigned_at = COALESCE(assigned_at, now()),
    assignee_id = CASE 
      -- If this is the only assignment, set the assignee_id
      WHEN (
        SELECT COUNT(*) 
        FROM task_assignments 
        WHERE reservation_flow_id = NEW.reservation_flow_id 
        AND task_id = NEW.task_id
      ) = 1 THEN NEW.user_id
      -- Otherwise, set to NULL if there are multiple assignments
      ELSE NULL
    END
  WHERE reservation_flow_id = NEW.reservation_flow_id
  AND task_id = NEW.task_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_task_assignment ON task_assignments;
CREATE TRIGGER on_task_assignment
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_assignment();

-- Create additional indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_task_assignments_reservation_flow_id_task_id 
ON task_assignments(reservation_flow_id, task_id);

CREATE INDEX IF NOT EXISTS idx_task_assignments_user_task 
ON task_assignments(user_id, task_id);

-- Fix any existing data issues
UPDATE task_assignments
SET assigned_by = user_id
WHERE assigned_by IS NULL;