/*
  # Update payment flow started_at handling

  1. Changes
    - Make started_at nullable
    - Set started_at to NULL for pending flows
    - Update trigger to set started_at only when flow starts
    
  2. Notes
    - Maintain existing data integrity
    - Allow manual editing for admins
*/

-- Make started_at nullable
ALTER TABLE commission_flows
  ALTER COLUMN started_at DROP NOT NULL;

-- Reset started_at for pending flows
UPDATE commission_flows
SET started_at = NULL
WHERE status = 'pending';

-- Update trigger function to handle flow status changes
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

-- Add policies for admin to update started_at
DROP POLICY IF EXISTS "Administradores pueden gestionar flujos y vendedores pueden actualizar sus flujos" ON commission_flows;

CREATE POLICY "Administradores pueden gestionar flujos y vendedores pueden actualizar sus flujos"
  ON commission_flows FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN broker_commissions bc ON bc.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND bc.id = commission_flows.broker_commission_id
      AND p.is_seller = true
    )
  )
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN broker_commissions bc ON bc.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND bc.id = commission_flows.broker_commission_id
      AND p.is_seller = true
    )
  );