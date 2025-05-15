/*
  # Update sale flow stages and tasks

  1. Changes
    - Update Promesa stage tasks
    - Update Escrituración stage tasks
    - Handle existing task references safely
    - Maintain data integrity

  2. Notes
    - Use safe update approach to avoid foreign key violations
    - Keep existing task references intact
    - Update task names and order
*/

DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
  v_task_id uuid;
  v_order integer;
BEGIN
  -- Get the flow ID
  SELECT id INTO v_flow_id 
  FROM sale_flows 
  WHERE name = 'Flujo de Venta Regular';

  -- Update Promesa stage tasks
  SELECT id INTO v_stage_id 
  FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Promesa';

  -- Update existing Promesa tasks
  v_order := 1;
  FOR v_task_id IN (
    SELECT id FROM sale_flow_tasks 
    WHERE stage_id = v_stage_id 
    ORDER BY "order"
  )
  LOOP
    UPDATE sale_flow_tasks SET
      name = CASE v_order
        WHEN 1 THEN 'PENDIENTE GENERACIÓN PROMESA'
        WHEN 2 THEN 'PENDIENTE VB PROMESA'
        WHEN 3 THEN 'FIRMA PROMESA COORDINADA'
        WHEN 4 THEN 'PROMESA DE COMPRA ENTREGADA A OPERACIONES'
        WHEN 5 THEN 'PROMESA DE COMPRA ENTREGA A CLIENTE'
      END,
      description = 'Tarea del proceso de promesa',
      "order" = v_order
    WHERE id = v_task_id;
    v_order := v_order + 1;
  END LOOP;

  -- Add any missing Promesa tasks
  WHILE v_order <= 5 LOOP
    INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required)
    VALUES (
      v_stage_id,
      CASE v_order
        WHEN 1 THEN 'PENDIENTE GENERACIÓN PROMESA'
        WHEN 2 THEN 'PENDIENTE VB PROMESA'
        WHEN 3 THEN 'FIRMA PROMESA COORDINADA'
        WHEN 4 THEN 'PROMESA DE COMPRA ENTREGADA A OPERACIONES'
        WHEN 5 THEN 'PROMESA DE COMPRA ENTREGA A CLIENTE'
      END,
      'Tarea del proceso de promesa',
      v_order,
      true
    );
    v_order := v_order + 1;
  END LOOP;

  -- Update Escrituración stage tasks
  SELECT id INTO v_stage_id 
  FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Escrituración';

  -- Update existing Escrituración tasks
  v_order := 1;
  FOR v_task_id IN (
    SELECT id FROM sale_flow_tasks 
    WHERE stage_id = v_stage_id 
    ORDER BY "order"
  )
  LOOP
    UPDATE sale_flow_tasks SET
      name = CASE v_order
        WHEN 1 THEN 'APROBACIÓN CHIP PENDIENTE'
        WHEN 2 THEN 'PENDIENTE SET HIPOTECARIO'
        WHEN 3 THEN 'PENDIENTE TASACIÓN'
        WHEN 4 THEN 'A LA ESPERA DE TASACIÓN'
        WHEN 5 THEN 'DPS PENDIENTE'
        WHEN 6 THEN 'ESTUDIO DE TÍTULOS PENDIENTES'
        WHEN 7 THEN 'GASTOS OPERACIONALES PENDIENTES'
        WHEN 8 THEN 'PENDIENTE VISACIÓN'
        WHEN 9 THEN 'BORRADOR EN CONFECCIÓN'
        WHEN 10 THEN 'PENDIENTE FIRMA ESCRITURA'
        WHEN 11 THEN 'SALDOS ESCRITURA PENDIENTES'
        WHEN 12 THEN 'LIQUIDAR'
        WHEN 13 THEN 'PENDIENTE ENTREGA'
      END,
      description = 'Tarea del proceso de escrituración',
      "order" = v_order
    WHERE id = v_task_id;
    v_order := v_order + 1;
  END LOOP;

  -- Add any missing Escrituración tasks
  WHILE v_order <= 13 LOOP
    INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required)
    VALUES (
      v_stage_id,
      CASE v_order
        WHEN 1 THEN 'APROBACIÓN CHIP PENDIENTE'
        WHEN 2 THEN 'PENDIENTE SET HIPOTECARIO'
        WHEN 3 THEN 'PENDIENTE TASACIÓN'
        WHEN 4 THEN 'A LA ESPERA DE TASACIÓN'
        WHEN 5 THEN 'DPS PENDIENTE'
        WHEN 6 THEN 'ESTUDIO DE TÍTULOS PENDIENTES'
        WHEN 7 THEN 'GASTOS OPERACIONALES PENDIENTES'
        WHEN 8 THEN 'PENDIENTE VISACIÓN'
        WHEN 9 THEN 'BORRADOR EN CONFECCIÓN'
        WHEN 10 THEN 'PENDIENTE FIRMA ESCRITURA'
        WHEN 11 THEN 'SALDOS ESCRITURA PENDIENTES'
        WHEN 12 THEN 'LIQUIDAR'
        WHEN 13 THEN 'PENDIENTE ENTREGA'
      END,
      'Tarea del proceso de escrituración',
      v_order,
      true
    );
    v_order := v_order + 1;
  END LOOP;

END $$;