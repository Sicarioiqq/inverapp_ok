/*
  # Add task assignment date tracking

  1. Changes
    - Add assigned_at column to reservation_flow_tasks
    - Update trigger function to track first assignment
    - Add function to handle task assignments

  2. Security
    - Maintain existing RLS policies
    - Ensure data consistency
*/

-- Add assigned_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservation_flow_tasks' 
    AND column_name = 'assigned_at'
  ) THEN
    ALTER TABLE reservation_flow_tasks 
    ADD COLUMN assigned_at timestamptz;
  END IF;
END $$;

-- Create index for assigned_at
CREATE INDEX IF NOT EXISTS idx_reservation_flow_tasks_assigned_at 
ON reservation_flow_tasks(assigned_at);

-- Create function to handle task assignments
CREATE OR REPLACE FUNCTION handle_task_assignment()
RETURNS trigger AS $$
BEGIN
  -- Update assigned_at in reservation_flow_tasks when first user is assigned
  UPDATE reservation_flow_tasks
  SET assigned_at = COALESCE(assigned_at, now())
  WHERE reservation_flow_id = NEW.reservation_flow_id
  AND task_id = NEW.task_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task assignments
DROP TRIGGER IF EXISTS on_task_assignment ON task_assignments;
CREATE TRIGGER on_task_assignment
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_assignment();

-- Update trigger function to handle task status and assignments
CREATE OR REPLACE FUNCTION handle_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_is_admin boolean;
  v_has_assignments boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  ) INTO v_is_admin;

  -- Check if task has any assignments
  SELECT EXISTS (
    SELECT 1 FROM task_assignments
    WHERE reservation_flow_id = NEW.reservation_flow_id
    AND task_id = NEW.task_id
  ) INTO v_has_assignments;

  -- Set started_at when task is first assigned or status changes from pending
  IF (OLD.status = 'pending' OR OLD.status IS NULL) AND NEW.status != 'pending' THEN
    NEW.started_at = COALESCE(NEW.started_at, now());
  END IF;

  -- Task being completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Set completion date
    NEW.completed_at = COALESCE(NEW.completed_at, now());
    
    -- Remove all task assignments
    DELETE FROM task_assignments
    WHERE reservation_flow_id = NEW.reservation_flow_id
    AND task_id = NEW.task_id;

    -- Clear assigned_at when all assignments are removed
    NEW.assigned_at = NULL;
  
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