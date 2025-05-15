/*
  # Add date tracking fields to commission flow tasks

  1. Changes
    - Add expected_date field to payment_flow_tasks
    - Add days_to_complete field to payment_flow_tasks
    - Add function to calculate days elapsed
    - Update policies to allow admin date modifications
*/

-- Add expected_date and days_to_complete to payment_flow_tasks
ALTER TABLE payment_flow_tasks
  ADD COLUMN expected_date date,
  ADD COLUMN days_to_complete integer;

-- Add function to calculate days elapsed
CREATE OR REPLACE FUNCTION calculate_days_elapsed(
  p_start_date timestamptz,
  p_end_date timestamptz
) RETURNS integer AS $$
BEGIN
  IF p_start_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN EXTRACT(DAY FROM COALESCE(p_end_date, now()) - p_start_date)::integer;
END;
$$ LANGUAGE plpgsql;

-- Update trigger function to handle date changes
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

-- Add expected completion dates for existing tasks
UPDATE payment_flow_tasks
SET days_to_complete = CASE
  WHEN name LIKE '%Solicitud%' THEN 1
  WHEN name LIKE '%VB%' THEN 2
  WHEN name LIKE '%Generación%' THEN 2
  WHEN name LIKE '%Aprobación%' THEN 2
  WHEN name LIKE '%Envío%' THEN 1
  WHEN name LIKE '%Recepción%' THEN 3
  ELSE 2
END;