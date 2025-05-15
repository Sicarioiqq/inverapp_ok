/*
  # Fix task status management and permissions

  1. Changes
    - Add completed_at column if not exists
    - Create trigger function for task status changes
    - Update policies for task management
    - Ensure proper access control for completed tasks
*/

-- Add completed_at column if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservation_flow_tasks' 
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE reservation_flow_tasks 
    ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- Create helper function to check admin status
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function for task status changes
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
    NEW.completed_at = now();
  
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

-- Update task management policies
DROP POLICY IF EXISTS "Administradores pueden gestionar tareas y vendedores pueden actualizar tareas no completadas" ON reservation_flow_tasks;

CREATE POLICY "Administradores pueden gestionar todas las tareas y vendedores solo las no completadas"
  ON reservation_flow_tasks FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR (
      status != 'completed' AND
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN reservations r ON r.seller_id = p.id
        JOIN reservation_flows rf ON rf.reservation_id = r.id
        WHERE p.id = auth.uid()
        AND rf.id = reservation_flow_id
        AND p.is_seller = true
      )
    )
  )
  WITH CHECK (
    is_admin() OR (
      status != 'completed' AND
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN reservations r ON r.seller_id = p.id
        JOIN reservation_flows rf ON rf.reservation_id = r.id
        WHERE p.id = auth.uid()
        AND rf.id = reservation_flow_id
        AND p.is_seller = true
      )
    )
  );