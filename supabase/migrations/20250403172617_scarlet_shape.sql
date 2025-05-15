/*
  # Fix task order in Aprobación Jefe Inversiones stage

  1. Changes
    - Reorder tasks in the Aprobación Jefe Inversiones stage
    - Ensure "Solicitud a Jefe Inversiones" comes before "VB Jefe Inversiones"
    - Maintain existing task IDs and relationships
    - Update task order values

  2. Notes
    - Uses temporary high order numbers to avoid constraint violations
    - Preserves task descriptions and other attributes
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
  v_temp_order integer := 1000; -- Temporary high order number to avoid conflicts
BEGIN
  -- Get the flow ID for the payment flow
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Pago Principal';

  -- Get the stage ID for Aprobación Jefe Inversiones
  SELECT id INTO v_stage_id 
  FROM payment_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Aprobación Jefe Inversiones';

  -- First, update all existing tasks to have temporary high order numbers
  -- This avoids unique constraint violations during reordering
  UPDATE payment_flow_tasks
  SET "order" = "order" + v_temp_order
  WHERE stage_id = v_stage_id;

  -- Now update the tasks with the correct order
  -- Ensure "Solicitud a Jefe Inversiones" comes first
  UPDATE payment_flow_tasks
  SET "order" = 1
  WHERE stage_id = v_stage_id
  AND name = 'Solicitud a Jefe Inversiones';

  -- Ensure "VB Jefe Inversiones" comes second
  UPDATE payment_flow_tasks
  SET "order" = 2
  WHERE stage_id = v_stage_id
  AND name = 'VB Jefe Inversiones';

  -- If there are any other tasks in this stage, order them after these two
  UPDATE payment_flow_tasks
  SET "order" = "order" - v_temp_order + 2
  WHERE stage_id = v_stage_id
  AND name NOT IN ('Solicitud a Jefe Inversiones', 'VB Jefe Inversiones')
  AND "order" > v_temp_order;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;