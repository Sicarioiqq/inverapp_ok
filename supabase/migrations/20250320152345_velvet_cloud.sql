/*
  # Agregar tarea PENDIENTE CARTA PIE a la etapa de Escrituración

  1. Cambios
    - Agregar tarea "PENDIENTE CARTA PIE" al inicio de la etapa de Escrituración
    - Reordenar las tareas existentes
    - Mantener la estructura y relaciones

  2. Notas
    - Se usa un enfoque seguro para evitar duplicados
    - Se mantiene el orden de las tareas existentes
*/

DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
BEGIN
  -- Obtener el ID del flujo
  SELECT id INTO v_flow_id 
  FROM sale_flows 
  WHERE name = 'Flujo de Venta Regular';

  -- Obtener el ID de la etapa de Escrituración
  SELECT id INTO v_stage_id 
  FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Escrituración';

  -- Primero, eliminar todas las tareas existentes de la etapa
  DELETE FROM sale_flow_tasks 
  WHERE stage_id = v_stage_id;

  -- Insertar todas las tareas en el orden correcto
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required)
  VALUES
    (v_stage_id, 'PENDIENTE CARTA PIE', 'Carta de pie pendiente', 1, true),
    (v_stage_id, 'APROBACIÓN CHIP PENDIENTE', 'Aprobación de CHIP pendiente', 2, true),
    (v_stage_id, 'PENDIENTE SET HIPOTECARIO', 'Set hipotecario pendiente', 3, true),
    (v_stage_id, 'PENDIENTE TASACIÓN', 'Tasación pendiente', 4, true),
    (v_stage_id, 'A LA ESPERA DE TASACIÓN', 'Esperando resultado de tasación', 5, true),
    (v_stage_id, 'DPS PENDIENTE', 'DPS pendiente', 6, true),
    (v_stage_id, 'ESTUDIO DE TÍTULOS PENDIENTES', 'Estudio de títulos pendiente', 7, true),
    (v_stage_id, 'GASTOS OPERACIONALES PENDIENTES', 'Gastos operacionales pendientes', 8, true),
    (v_stage_id, 'PENDIENTE VISACIÓN', 'Visación pendiente', 9, true),
    (v_stage_id, 'BORRADOR EN CONFECCIÓN', 'Borrador en confección', 10, true),
    (v_stage_id, 'PENDIENTE FIRMA ESCRITURA', 'Firma de escritura pendiente', 11, true),
    (v_stage_id, 'SALDOS ESCRITURA PENDIENTES', 'Saldos de escritura pendientes', 12, true),
    (v_stage_id, 'LIQUIDAR', 'Liquidación pendiente', 13, true),
    (v_stage_id, 'PENDIENTE ENTREGA', 'Entrega pendiente', 14, true);

END $$;