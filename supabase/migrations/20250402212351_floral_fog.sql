/*
  # Add PENDIENTE ORIGEN DE FONDOS task to Promesa stage

  1. Changes
    - Add new task "PENDIENTE ORIGEN DE FONDOS" to Promesa stage
    - Position it between "PENDIENTE GENERACIÓN PROMESA" and "PENDIENTE VB PROMESA"
    - Reorder tasks safely without violating foreign key constraints
    
  2. Notes
    - Uses a safe approach that preserves existing task IDs
    - Avoids deleting tasks that might be referenced by reservation_flow_tasks
*/

DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
  v_task_exists boolean;
  v_max_order integer;
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
  
  -- Check if the task already exists
  SELECT EXISTS (
    SELECT 1 FROM sale_flow_tasks
    WHERE stage_id = v_stage_id
    AND name = 'PENDIENTE ORIGEN DE FONDOS'
  ) INTO v_task_exists;
  
  -- Only proceed if the task doesn't already exist
  IF NOT v_task_exists THEN
    -- Get the maximum current order
    SELECT COALESCE(MAX("order"), 0) INTO v_max_order
    FROM sale_flow_tasks
    WHERE stage_id = v_stage_id;
    
    -- First, update all tasks with order >= 2 to have temporary high order numbers
    -- This avoids unique constraint violations during reordering
    UPDATE sale_flow_tasks
    SET "order" = "order" + v_temp_order
    WHERE stage_id = v_stage_id
    AND "order" >= 2;
    
    -- Now insert the new task at order 2
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
    
    -- Update the order of tasks that were moved
    UPDATE sale_flow_tasks
    SET "order" = "order" - v_temp_order + 1
    WHERE stage_id = v_stage_id
    AND "order" > v_temp_order;
  END IF;
END $$;