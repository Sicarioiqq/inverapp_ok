/*
  # Crear flujos de venta para reservas existentes

  1. Cambios
    - Insertar flujos de venta para cada reserva existente
    - Establecer estado inicial como 'in_progress'
    - Asignar primera etapa como etapa actual
*/

DO $$
DECLARE
  v_flow_id uuid;
  v_first_stage_id uuid;
  v_reservation RECORD;
BEGIN
  -- Obtener el ID del flujo de venta regular
  SELECT id INTO v_flow_id 
  FROM sale_flows 
  WHERE name = 'Flujo de Venta Regular';

  -- Obtener el ID de la primera etapa (Reserva)
  SELECT id INTO v_first_stage_id 
  FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND "order" = 1;

  -- Crear flujos para cada reserva que no tenga uno
  FOR v_reservation IN 
    SELECT r.id 
    FROM reservations r
    LEFT JOIN reservation_flows rf ON rf.reservation_id = r.id
    WHERE rf.id IS NULL
  LOOP
    INSERT INTO reservation_flows (
      reservation_id,
      flow_id,
      current_stage_id,
      status
    ) VALUES (
      v_reservation.id,
      v_flow_id,
      v_first_stage_id,
      'in_progress'
    );
  END LOOP;
END $$;