/*
  # Add PENDIENTE ORIGEN DE FONDOS task to Promesa stage

  1. Changes
    - Add new task "PENDIENTE ORIGEN DE FONDOS" to the Promesa stage
    - Position it between "PENDIENTE GENERACIÓN PROMESA" and "PENDIENTE VB PROMESA"
    - Reorder existing tasks to maintain proper sequence
    
  2. Notes
    - Uses temporary high order numbers to avoid constraint violations
    - Preserves existing task relationships and data
*/

DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
  v_temp_order integer := 1000; -- Temporary high order number to avoid conflicts
BEGIN
  -- Get the flow ID
  SELECT id INTO v_flow_id 
  FROM sale_flows 
  WHERE name = 'Flujo de Venta Regular';

  -- Get the Promesa stage ID
  SELECT id INTO v_stage_id 
  FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Promesa';

  -- First, update all existing tasks to have temporary high order numbers
  -- This avoids unique constraint violations during reordering
  UPDATE sale_flow_tasks
  SET "order" = "order" + v_temp_order
  WHERE stage_id = v_stage_id;

  -- Now insert the new task
  INSERT INTO sale_flow_tasks (
    stage_id, 
    name, 
    description, 
    "order", 
    is_required
  ) VALUES (
    v_stage_id,
    'PENDIENTE ORIGEN DE FONDOS',
    'Verificación del origen de fondos del cliente',
    2,
    true
  );

  -- Update the order of existing tasks
  UPDATE sale_flow_tasks
  SET "order" = CASE 
    WHEN name = 'PENDIENTE GENERACIÓN PROMESA' THEN 1
    WHEN name = 'PENDIENTE ORIGEN DE FONDOS' THEN 2
    WHEN name = 'PENDIENTE VB PROMESA' THEN 3
    WHEN name = 'FIRMA PROMESA COORDINADA' THEN 4
    WHEN name = 'PROMESA DE COMPRA ENTREGADA A OPERACIONES' THEN 5
    WHEN name = 'PROMESA DE COMPRA ENTREGA A CLIENTE' THEN 6
    ELSE "order" - v_temp_order + 6 -- For any other tasks
  END
  WHERE stage_id = v_stage_id;

END $$;