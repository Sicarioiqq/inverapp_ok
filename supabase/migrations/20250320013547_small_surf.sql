/*
  # Update Sale Flow Stages and Tasks

  1. Changes
    - Remove 'Documentación' and 'Entrega' stages
    - Update 'Promesa' stage tasks
    - Update 'Escrituración' stage tasks
    - Add 'Reparos' stage with tasks

  2. Notes
    - Handle foreign key constraints properly
    - Maintain data integrity
    - Update in correct order to avoid constraint violations
*/

DO $$ 
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
BEGIN
  -- Get the flow ID
  SELECT id INTO v_flow_id 
  FROM sale_flows 
  WHERE name = 'Flujo de Venta Regular';

  -- First delete tasks for stages we want to remove
  DELETE FROM sale_flow_tasks 
  WHERE stage_id IN (
    SELECT id FROM sale_flow_stages 
    WHERE flow_id = v_flow_id 
    AND name IN ('Documentación', 'Entrega')
  );

  -- Now we can safely delete the stages
  DELETE FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name IN ('Documentación', 'Entrega');

  -- Update remaining stages order
  UPDATE sale_flow_stages 
  SET "order" = CASE name
    WHEN 'Reserva' THEN 1
    WHEN 'Promesa' THEN 2
    WHEN 'Escrituración' THEN 3
    ELSE "order"
  END
  WHERE flow_id = v_flow_id;

  -- Update Promesa tasks
  -- First delete existing tasks
  DELETE FROM sale_flow_tasks 
  WHERE stage_id IN (
    SELECT id FROM sale_flow_stages 
    WHERE flow_id = v_flow_id AND name = 'Promesa'
  );

  -- Then insert new tasks
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required)
  SELECT 
    id as stage_id,
    unnest(ARRAY[
      'PENDIENTE GENERACIÓN PROMESA',
      'PENDIENTE VB PROMESA',
      'FIRMA PROMESA COORDINADA',
      'PROMESA DE COMPRA ENTREGADA A OPERACIONES'
    ]) as name,
    'Tarea del proceso de promesa' as description,
    generate_series(1, 4) as "order",
    true as is_required
  FROM sale_flow_stages
  WHERE flow_id = v_flow_id AND name = 'Promesa';

  -- Update Escrituración tasks
  -- First delete existing tasks
  DELETE FROM sale_flow_tasks 
  WHERE stage_id IN (
    SELECT id FROM sale_flow_stages 
    WHERE flow_id = v_flow_id AND name = 'Escrituración'
  );

  -- Then insert new tasks
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required)
  SELECT 
    id as stage_id,
    unnest(ARRAY[
      'APROBACIÓN CHIP PENDIENTE',
      'PENDIENTE SET HIPOTECARIO',
      'PENDIENTE TASACIÓN',
      'A LA ESPERA DE TASACIÓN',
      'DPS PENDIENTE',
      'GASTOS OPERACIONALES PENDIENTES',
      'BORRADOR EN CONFECCIÓN',
      'BORRADOR EN CONFECCIÓN',
      'PENDIENTE FIRMA ESCRITURA',
      'SALDOS ESCRITURA PENDIENTES',
      'LIQUIDAR',
      'PENDIENTE ENTREGA'
    ]) as name,
    'Tarea del proceso de escrituración' as description,
    generate_series(1, 12) as "order",
    true as is_required
  FROM sale_flow_stages
  WHERE flow_id = v_flow_id AND name = 'Escrituración';

  -- Create new Reparos stage
  INSERT INTO sale_flow_stages (flow_id, name, description, "order")
  VALUES (
    v_flow_id,
    'Reparos',
    'Gestión de reparos y correcciones',
    4
  )
  RETURNING id INTO v_stage_id;

  -- Insert Reparos tasks
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required)
  VALUES
    (v_stage_id, 'REPARO OPERACIONES', 'Tarea del proceso de reparos', 1, true),
    (v_stage_id, 'REPARO COMERCIAL', 'Tarea del proceso de reparos', 2, true),
    (v_stage_id, 'REPARO BANCO', 'Tarea del proceso de reparos', 3, true);

END $$;