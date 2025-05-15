/*
  # Fix payment flow task status handling for admins

  1. Changes
    - Update handle_task_status_change function to bypass task order validation for admins
    - Maintain task completion tracking
    - Keep existing flow completion logic
    
  2. Security
    - Only allow admins to bypass task order
    - Maintain existing RLS policies
*/

-- Update handle_task_status_change function to bypass validation for admins
CREATE OR REPLACE FUNCTION handle_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_is_admin boolean;
  v_flow_status text;
  v_stage_order int;
  v_task_order int;
  v_prev_task_completed boolean;
  v_prev_stage_completed boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  ) INTO v_is_admin;

  -- Allow admins to modify dates directly
  IF v_is_admin AND (
    NEW.started_at IS DISTINCT FROM OLD.started_at OR
    NEW.completed_at IS DISTINCT FROM OLD.completed_at
  ) THEN
    RETURN NEW;
  END IF;

  -- Get flow status and task order information
  SELECT 
    cf.status,
    pfs."order",
    pft."order"
  INTO 
    v_flow_status,
    v_stage_order,
    v_task_order
  FROM commission_flows cf
  JOIN payment_flow_stages pfs ON pfs.id = cf.current_stage_id
  JOIN payment_flow_tasks pft ON pft.stage_id = pfs.id AND pft.id = NEW.task_id;

  -- Check if flow is pending
  IF v_flow_status = 'pending' THEN
    RAISE EXCEPTION 'No se pueden modificar tareas mientras el flujo esté pendiente';
  END IF;

  -- Skip task order validation for admins
  IF NOT v_is_admin THEN
    -- Check previous task completion if not first task
    IF v_task_order > 1 THEN
      SELECT EXISTS (
        SELECT 1
        FROM commission_flow_tasks cft
        JOIN payment_flow_tasks pft ON pft.id = cft.task_id
        WHERE cft.commission_flow_id = NEW.commission_flow_id
        AND pft.stage_id = (SELECT stage_id FROM payment_flow_tasks WHERE id = NEW.task_id)
        AND pft."order" = v_task_order - 1
        AND cft.status = 'completed'
      ) INTO v_prev_task_completed;

      IF NOT v_prev_task_completed AND NEW.status != 'blocked' THEN
        RAISE EXCEPTION 'No se puede modificar esta tarea hasta que se complete la tarea anterior';
      END IF;
    END IF;

    -- Check previous stage completion if not first stage
    IF v_stage_order > 1 THEN
      SELECT EXISTS (
        SELECT 1
        FROM commission_flow_tasks cft
        JOIN payment_flow_tasks pft ON pft.id = cft.task_id
        JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
        WHERE cft.commission_flow_id = NEW.commission_flow_id
        AND pfs."order" = v_stage_order - 1
        AND cft.status = 'completed'
      ) INTO v_prev_stage_completed;

      IF NOT v_prev_stage_completed AND NEW.status != 'blocked' THEN
        RAISE EXCEPTION 'No se puede modificar esta tarea hasta que se complete la etapa anterior';
      END IF;
    END IF;
  END IF;

  -- Set started_at when task is first assigned or status changes from pending
  IF (OLD.status = 'pending' OR OLD.status IS NULL) AND NEW.status != 'pending' THEN
    NEW.started_at = COALESCE(NEW.started_at, now());
  END IF;

  -- Handle task completion
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar tareas completadas';
    END IF;
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_task_status_change ON commission_flow_tasks;
CREATE TRIGGER on_task_status_change
  BEFORE UPDATE ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_status_change();