/*
  # Fix task assignments system to remove commission_flow_id references

  1. Changes
    - Update handle_task_assignment function to only use reservation_flow_id
    - Create proper indexes for better performance
    - Fix any existing data issues
*/

-- Create or replace the handle_task_assignment function to ensure it only uses reservation_flow_id
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

CREATE INDEX IF NOT EXISTS idx_task_assignments_task_user 
ON task_assignments(task_id, user_id);

-- Fix any existing data issues
UPDATE task_assignments
SET assigned_by = user_id
WHERE assigned_by IS NULL;

-- Create or replace the handle_task_status_change function to ensure it only uses reservation_flow_id
CREATE OR REPLACE FUNCTION handle_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  ) INTO v_is_admin;

  -- Task being completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Set completion date
    NEW.completed_at = now();
    
    -- Clear assignee when task is completed
    NEW.assignee_id = NULL;
    
    -- Remove all task assignments
    DELETE FROM task_assignments
    WHERE reservation_flow_id = NEW.reservation_flow_id
    AND task_id = NEW.task_id;
  
  -- Task being uncompleted
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar tareas completadas';
    END IF;
    NEW.completed_at = NULL;
  
  -- Completed date being modified directly
  ELSIF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar la fecha de completado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;