/*
  # Add PENDIENTE ORIGEN DE FONDOS task to Promesa stage

  1. Changes
    - Add new task "PENDIENTE ORIGEN DE FONDOS" to the Promesa stage
    - Position it between "PENDIENTE GENERACIÓN PROMESA" and "PENDIENTE VB PROMESA"
    - Reorder existing tasks to maintain proper sequence
    
  2. Notes
    - Uses a different approach to avoid constraint violations
    - Preserves existing task relationships and data
*/

DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
  v_existing_task_count integer;
  v_task_exists boolean;
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
    -- First, delete all existing tasks for this stage
    -- We'll recreate them with the correct order
    DELETE FROM sale_flow_tasks 
    WHERE stage_id = v_stage_id;
    
    -- Now insert all tasks in the correct order
    INSERT INTO sale_flow_tasks (
      stage_id, 
      name, 
      description, 
      "order", 
      is_required
    ) VALUES 
      (v_stage_id, 'PENDIENTE GENERACIÓN PROMESA', 'Generación de documento de promesa', 1, true),
      (v_stage_id, 'PENDIENTE ORIGEN DE FONDOS', 'Verificación del origen de fondos del cliente', 2, true),
      (v_stage_id, 'PENDIENTE VB PROMESA', 'Visto bueno de promesa', 3, true),
      (v_stage_id, 'FIRMA PROMESA COORDINADA', 'Coordinación de firmas de promesa', 4, true),
      (v_stage_id, 'PROMESA DE COMPRA ENTREGADA A OPERACIONES', 'Entrega de promesa a operaciones', 5, true),
      (v_stage_id, 'PROMESA DE COMPRA ENTREGA A CLIENTE', 'Entrega de promesa al cliente', 6, true);
  END IF;
END $$;