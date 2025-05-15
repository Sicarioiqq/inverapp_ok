/*
  # Actualizar flujo de segundo pago con nuevas etapas

  1. Cambios
    - Actualizar el flujo de segundo pago con las etapas correctas
    - Agregar etapas faltantes: Recepción Factura 2 Broker, Generación de Entrada 2, etc.
    - Mantener la estructura y relaciones existentes
    
  2. Notas
    - Preserva los flujos existentes
    - Mejora la gestión de pagos secundarios
*/

-- Temporalmente desactivar el trigger que aplica validación
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Primero, eliminar las etapas y tareas existentes del flujo de segundo pago
DO $$
DECLARE
  v_flow_id uuid;
BEGIN
  -- Obtener el ID del flujo de segundo pago
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Segundo Pago';

  -- Eliminar las tareas existentes
  DELETE FROM payment_flow_tasks
  WHERE stage_id IN (
    SELECT id FROM payment_flow_stages
    WHERE flow_id = v_flow_id
  );
  
  -- Eliminar las etapas existentes
  DELETE FROM payment_flow_stages
  WHERE flow_id = v_flow_id;
END $$;

-- Crear las nuevas etapas y tareas para el flujo de segundo pago
DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
BEGIN
  -- Obtener el ID del flujo de segundo pago
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Segundo Pago';

  -- Crear etapa de Entrada
  INSERT INTO payment_flow_stages (flow_id, name, description, "order", is_active)
  VALUES (v_flow_id, 'Entrada', 'Proceso de entrada para segundo pago', 1, true)
  RETURNING id INTO v_stage_id;
  
  -- Crear tareas para la etapa de Entrada
  INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
  VALUES 
    (v_stage_id, 'Generación de Entrada', 'Generación de entrada en sistema para segundo pago', 1, true, 2),
    (v_stage_id, 'Aprobación de Entrada', 'Aprobación de la entrada generada para segundo pago', 2, true, 2),
    (v_stage_id, 'Envío Entrada Broker', 'Envío de entrada al Broker para segundo pago', 3, true, 1);

  -- Crear etapa de Facturación
  INSERT INTO payment_flow_stages (flow_id, name, description, "order", is_active)
  VALUES (v_flow_id, 'Facturación', 'Proceso de facturación para segundo pago', 2, true)
  RETURNING id INTO v_stage_id;
  
  -- Crear tareas para la etapa de Facturación
  INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
  VALUES 
    (v_stage_id, 'Recepción Factura 2 Broker', 'Recepción de factura del Broker para segundo pago', 1, true, 3),
    (v_stage_id, 'Generación de Entrada 2', 'Generación de entrada en sistema para segundo pago', 2, true, 2),
    (v_stage_id, 'Aprobación de Entrada 2', 'Aprobación de la entrada generada para segundo pago', 3, true, 2);

  -- Crear etapa de Pago
  INSERT INTO payment_flow_stages (flow_id, name, description, "order", is_active)
  VALUES (v_flow_id, 'Pago', 'Proceso de pago para segundo pago', 3, true)
  RETURNING id INTO v_stage_id;
  
  -- Crear tareas para la etapa de Pago
  INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
  VALUES 
    (v_stage_id, 'Notificación a Finanzas 2', 'Notificación del pago a Finanzas para segundo pago', 1, true, 1),
    (v_stage_id, 'Fecha de Pago 2', 'Registro de fecha de pago efectivo para segundo pago', 2, true, 2);
END $$;

-- Función para manejar la actualización de la fecha de pago 2 en la comisión
CREATE OR REPLACE FUNCTION handle_fecha_pago_2_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_broker_commission_id uuid;
  v_reservation_number text;
  v_is_second_payment boolean;
BEGIN
  -- Solo proceder si la tarea está siendo completada o si la fecha de completado cambió
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Obtener el ID del flujo
    SELECT flow_id, is_second_payment INTO v_flow_id, v_is_second_payment
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Verificar si esta es la tarea Fecha de Pago 2 y es un flujo de segundo pago
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Pago'
      AND t.name = 'Fecha de Pago 2'
    ) AND v_is_second_payment = true THEN
      -- Obtener el ID de la comisión de broker asociada a este flujo
      SELECT 
        bc.id,
        r.reservation_number
      INTO 
        v_broker_commission_id,
        v_reservation_number
      FROM commission_flows cf
      JOIN broker_commissions bc ON bc.id = cf.broker_commission_id
      JOIN reservations r ON r.id = bc.reservation_id
      WHERE cf.id = NEW.commission_flow_id;
      
      -- Si se encontró la comisión, actualizar la fecha de pago 2
      IF v_broker_commission_id IS NOT NULL THEN
        -- Actualizar la fecha de pago 2 en la comisión
        UPDATE broker_commissions
        SET payment_2_date = NEW.completed_at::date
        WHERE id = v_broker_commission_id;
        
        -- Registrar la actualización en los logs
        RAISE NOTICE 'Actualizada fecha de pago 2 para reserva % a %', 
          v_reservation_number, 
          NEW.completed_at::date;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para la actualización de la fecha de pago 2
DROP TRIGGER IF EXISTS on_fecha_pago_2_completion ON commission_flow_tasks;
CREATE TRIGGER on_fecha_pago_2_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_fecha_pago_2_completion();

-- Re-habilitar el trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;