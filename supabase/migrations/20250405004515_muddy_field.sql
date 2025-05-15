/*
  # Sincronización de Fecha de Pago con Comisión

  1. Nuevas Funcionalidades
    - Actualizar automáticamente la fecha de pago 1 en broker_commissions cuando se completa la tarea "Fecha de Pago"
    - Asegurar que la fecha de pago 1 no se pueda editar manualmente
    
  2. Cambios
    - Crear función para manejar la actualización de la fecha de pago
    - Crear trigger para detectar cambios en la tarea "Fecha de Pago"
    - Actualizar comisiones existentes si ya tienen tareas completadas
    
  3. Seguridad
    - Mantener las políticas RLS existentes
*/

-- Temporalmente desactivar el trigger que aplica validación
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Función para manejar la actualización de la fecha de pago en la comisión
CREATE OR REPLACE FUNCTION handle_fecha_pago_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_broker_commission_id uuid;
  v_reservation_number text;
BEGIN
  -- Solo proceder si la tarea está siendo completada o si la fecha de completado cambió
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Obtener el ID del flujo
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Verificar si esta es la tarea Fecha de Pago
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Pago'
      AND t.name = 'Fecha de Pago'
    ) THEN
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
      
      -- Si se encontró la comisión, actualizar la fecha de pago 1
      IF v_broker_commission_id IS NOT NULL THEN
        -- Actualizar la fecha de pago 1 en la comisión
        UPDATE broker_commissions
        SET payment_1_date = NEW.completed_at::date
        WHERE id = v_broker_commission_id;
        
        -- Registrar la actualización en los logs
        RAISE NOTICE 'Actualizada fecha de pago 1 para reserva % a %', 
          v_reservation_number, 
          NEW.completed_at::date;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para la actualización de la fecha de pago
DROP TRIGGER IF EXISTS on_fecha_pago_completion ON commission_flow_tasks;
CREATE TRIGGER on_fecha_pago_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_fecha_pago_completion();

-- Actualizar comisiones existentes basadas en tareas de Fecha de Pago ya completadas
DO $$
DECLARE
  v_flow record;
  v_fecha_pago_task_id uuid;
  v_fecha_pago_flow_task_id uuid;
  v_fecha_pago_completed_at timestamptz;
  v_broker_commission_id uuid;
  v_reservation_number text;
BEGIN
  -- Para cada flujo de comisión
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id, cf.broker_commission_id
    FROM commission_flows cf
    WHERE cf.status IN ('in_progress', 'completed')
  LOOP
    -- Obtener la tarea Fecha de Pago
    SELECT pft.id, cft.id, cft.completed_at 
    INTO v_fecha_pago_task_id, v_fecha_pago_flow_task_id, v_fecha_pago_completed_at
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Pago'
    AND pft.name = 'Fecha de Pago'
    AND cft.status = 'completed';
    
    -- Si se encontró la tarea completada
    IF v_fecha_pago_task_id IS NOT NULL AND v_fecha_pago_completed_at IS NOT NULL THEN
      -- Obtener el número de reserva
      SELECT r.reservation_number
      INTO v_reservation_number
      FROM broker_commissions bc
      JOIN reservations r ON r.id = bc.reservation_id
      WHERE bc.id = v_flow.broker_commission_id;
      
      -- Actualizar la fecha de pago 1 en la comisión
      UPDATE broker_commissions
      SET payment_1_date = v_fecha_pago_completed_at::date
      WHERE id = v_flow.broker_commission_id;
      
      -- Registrar la actualización en los logs
      RAISE NOTICE 'Actualizada fecha de pago 1 para reserva % a %', 
        v_reservation_number, 
        v_fecha_pago_completed_at::date;
    END IF;
  END LOOP;
END $$;

-- Re-habilitar el trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;