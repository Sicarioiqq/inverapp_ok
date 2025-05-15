/*
  # Update Escrituración stage tasks order

  1. Changes
    - Update tasks in Escrituración stage with correct order
    - Maintain existing task IDs and relationships
    - Ensure proper task sequence

  2. Notes
    - Tasks are ordered according to business process
    - Maintain data integrity during update
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

  -- Get the Escrituración stage ID
  SELECT id INTO v_stage_id 
  FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Escrituración';

  -- First, delete all existing tasks for this stage
  DELETE FROM sale_flow_tasks 
  WHERE stage_id = v_stage_id;

  -- Insert all tasks in the correct order
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required)
  VALUES
    (v_stage_id, 'PENDIENTE CARTA PIE', 'Carta de pie pendiente', 1, true),
    (v_stage_id, 'APROBACIÓN CHIP PENDIENTE', 'Aprobación de CHIP pendiente', 2, true),
    (v_stage_id, 'PENDIENTE SET HIPOTECARIO', 'Set hipotecario pendiente', 3, true),
    (v_stage_id, 'GASTOS OPERACIONALES PENDIENTES', 'Gastos operacionales pendientes', 4, true),
    (v_stage_id, 'PENDIENTE TASACIÓN', 'Tasación pendiente', 5, true),
    (v_stage_id, 'A LA ESPERA DE TASACIÓN', 'Esperando resultado de tasación', 6, true),
    (v_stage_id, 'DPS PENDIENTE', 'DPS pendiente', 7, true),
    (v_stage_id, 'ESTUDIO DE TÍTULOS PENDIENTES', 'Estudio de títulos pendiente', 8, true),
    (v_stage_id, 'PENDIENTE VISACIÓN', 'Visación pendiente', 9, true),
    (v_stage_id, 'BORRADOR EN CONFECCIÓN', 'Borrador en confección', 10, true),
    (v_stage_id, 'PENDIENTE FIRMA ESCRITURA', 'Firma de escritura pendiente', 11, true),
    (v_stage_id, 'SALDOS ESCRITURA PENDIENTES', 'Saldos de escritura pendientes', 12, true),
    (v_stage_id, 'PENDIENTE ENTREGA', 'Entrega pendiente', 13, true);

END $$;