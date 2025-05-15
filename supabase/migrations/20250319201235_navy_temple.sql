/*
  # Actualizar tareas de la etapa de Reserva

  1. Cambios
    - Actualizar las tareas de la etapa de Reserva con las nuevas tareas solicitadas
    - Mantener el orden y la estructura existente
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

  -- Obtener el ID de la etapa de Reserva
  SELECT id INTO v_stage_id 
  FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Reserva';

  -- Eliminar tareas existentes de la etapa
  DELETE FROM sale_flow_tasks 
  WHERE stage_id = v_stage_id;

  -- Insertar nuevas tareas
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required) VALUES
    (v_stage_id, 'COF PENDIENTE GENERACIÓN', 'Carta de oferta pendiente de ser generada', 1, true),
    (v_stage_id, 'COF PENDIENTE FIRMA', 'Carta de oferta pendiente de firma', 2, true),
    (v_stage_id, 'COF FIRMADA', 'Carta de oferta firmada por todas las partes', 3, true),
    (v_stage_id, 'SOLICITUD VB COF PENDIENTE', 'Solicitud de visto bueno de carta de oferta pendiente', 4, true);
END $$;