/*
  # Remove COF FIRMADA task and update task references

  1. Changes
    - Safely remove 'COF FIRMADA' task
    - Update task assignments and flow tasks
    - Reorder remaining tasks
    
  2. Notes
    - Handle existing references before deletion
    - Maintain data integrity
    - Update task order
*/

DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
  v_old_task_id uuid;
  v_pending_firma_id uuid;
BEGIN
  -- Get the flow ID
  SELECT id INTO v_flow_id 
  FROM sale_flows 
  WHERE name = 'Flujo de Venta Regular';

  -- Get the Reserva stage ID
  SELECT id INTO v_stage_id 
  FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Reserva';

  -- Get the IDs of both tasks
  SELECT id INTO v_old_task_id
  FROM sale_flow_tasks
  WHERE stage_id = v_stage_id
  AND name = 'COF FIRMADA';

  SELECT id INTO v_pending_firma_id
  FROM sale_flow_tasks
  WHERE stage_id = v_stage_id
  AND name = 'COF PENDIENTE FIRMA';

  -- First update any existing task assignments and flow tasks
  IF v_old_task_id IS NOT NULL AND v_pending_firma_id IS NOT NULL THEN
    -- Delete any duplicate task assignments
    DELETE FROM task_assignments ta
    WHERE ta.task_id = v_old_task_id
    AND EXISTS (
      SELECT 1 FROM task_assignments ta2
      WHERE ta2.task_id = v_pending_firma_id
      AND ta2.reservation_flow_id = ta.reservation_flow_id
      AND ta2.user_id = ta.user_id
    );

    -- Update remaining task assignments
    UPDATE task_assignments
    SET task_id = v_pending_firma_id
    WHERE task_id = v_old_task_id;

    -- Delete any duplicate reservation flow tasks
    DELETE FROM reservation_flow_tasks rft
    WHERE rft.task_id = v_old_task_id
    AND EXISTS (
      SELECT 1 FROM reservation_flow_tasks rft2
      WHERE rft2.task_id = v_pending_firma_id
      AND rft2.reservation_flow_id = rft.reservation_flow_id
    );

    -- Update remaining reservation flow tasks
    UPDATE reservation_flow_tasks
    SET task_id = v_pending_firma_id
    WHERE task_id = v_old_task_id;

    -- Now we can safely delete the old task
    DELETE FROM sale_flow_tasks 
    WHERE id = v_old_task_id;
  END IF;

  -- Update remaining tasks order
  UPDATE sale_flow_tasks
  SET "order" = CASE name
    WHEN 'COF PENDIENTE GENERACIÓN' THEN 1
    WHEN 'COF PENDIENTE FIRMA' THEN 2
    WHEN 'SOLICITUD VB COF PENDIENTE' THEN 3
    ELSE "order"
  END
  WHERE stage_id = v_stage_id;

END $$;