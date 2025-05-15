-- Update handle_task_status_change function to unassign users on completion
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

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_task_status_change ON reservation_flow_tasks;

-- Create trigger for task status changes
CREATE TRIGGER on_task_status_change
  BEFORE UPDATE ON reservation_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_status_change();