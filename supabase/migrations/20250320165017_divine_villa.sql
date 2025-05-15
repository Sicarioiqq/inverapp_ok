-- Add started_at column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservation_flow_tasks' 
    AND column_name = 'started_at'
  ) THEN
    ALTER TABLE reservation_flow_tasks 
    ADD COLUMN started_at timestamptz;
  END IF;
END $$;

-- Create index for started_at
CREATE INDEX IF NOT EXISTS idx_reservation_flow_tasks_started_at 
ON reservation_flow_tasks(started_at);

-- Update trigger function to handle started_at
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