/*
  # Add PENDIENTE ORIGEN DE FONDOS task to Promesa stage

  1. Changes
    - Add new task "PENDIENTE ORIGEN DE FONDOS" after "PENDIENTE GENERACIÓN PROMESA"
    - Reorder existing tasks to maintain proper sequence
    - Preserve foreign key relationships
    
  2. Notes
    - Uses a safe approach to avoid foreign key constraint violations
    - Maintains existing task references in reservation_flow_tasks
*/

DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
  v_task_exists boolean;
  v_task_id uuid;
  v_order integer;
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
    -- First, shift all tasks with order >= 2 to make room for the new task
    UPDATE sale_flow_tasks
    SET "order" = "order" + 1
    WHERE stage_id = v_stage_id
    AND "order" >= 2;
    
    -- Now insert the new task at position 2
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
  END IF;
END $$;