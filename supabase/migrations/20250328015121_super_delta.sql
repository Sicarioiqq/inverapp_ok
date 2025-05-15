-- Function to handle task status changes and date management
CREATE OR REPLACE FUNCTION handle_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_is_admin boolean;
  v_flow_status text;
  v_stage_order int;
  v_task_order int;
  v_prev_task_completed boolean;
  v_prev_stage_completed boolean;
  v_default_assignee_id uuid;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  ) INTO v_is_admin;

  -- Allow admins to modify dates and status directly
  IF v_is_admin THEN
    -- If changing status to completed and no completed_at is set, set it
    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at = now();
    END IF;
    -- If changing status from completed, allow clearing completed_at
    IF NEW.status != 'completed' AND OLD.status = 'completed' THEN
      NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Get flow status and task order information
  SELECT 
    cf.status,
    pfs."order",
    pft."order",
    pft.default_assignee_id
  INTO 
    v_flow_status,
    v_stage_order,
    v_task_order,
    v_default_assignee_id
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
    RAISE EXCEPTION 'Solo los administradores pueden modificar tareas completadas';
  END IF;

  -- Assign default user if not already assigned
  IF NEW.assignee_id IS NULL AND v_default_assignee_id IS NOT NULL THEN
    NEW.assignee_id = v_default_assignee_id;
    NEW.assigned_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate days between dates considering NULL values
CREATE OR REPLACE FUNCTION calculate_days_between(
  p_start_date timestamptz,
  p_end_date timestamptz DEFAULT NULL
) RETURNS integer AS $$
BEGIN
  IF p_start_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN EXTRACT(DAY FROM (COALESCE(p_end_date, now()) - p_start_date))::integer;
END;
$$ LANGUAGE plpgsql;

-- Add policies to allow admins to update task dates directly
DROP POLICY IF EXISTS "Administradores pueden gestionar todas las tareas" ON commission_flow_tasks;
CREATE POLICY "Administradores pueden gestionar todas las tareas"
  ON commission_flow_tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  );