/*
  # Automatización de Envío OC Broker basada en VB OC Gerencia General

  1. Nuevas Funcionalidades
    - Establecer la fecha de inicio de Envío OC Broker igual a la fecha de completado de VB OC Gerencia General
    - Actualizar automáticamente el estado de Envío OC Broker a pendiente cuando VB OC Gerencia General se completa
    - Mantener la sincronización de fechas entre tareas relacionadas
    
  2. Cambios
    - Crear función para manejar la lógica de automatización de Envío OC Broker
    - Crear trigger para detectar cambios en VB OC Gerencia General
    - Actualizar tareas existentes para mantener la consistencia
    
  3. Seguridad
    - Mantener las políticas RLS existentes
*/

-- Temporalmente desactivar el trigger que aplica validación
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Función para manejar la automatización de Envío OC Broker
CREATE OR REPLACE FUNCTION handle_vb_gerente_general_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_envio_oc_broker_task_id uuid;
  v_envio_oc_broker_flow_task_id uuid;
BEGIN
  -- Solo proceder si la tarea está siendo completada o si la fecha de completado cambió
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Obtener el ID del flujo
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Verificar si esta es la tarea VB OC Gerencia General
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'VB OC Gerencia General'
    ) THEN
      -- Obtener el ID de la tarea Envío OC Broker
      SELECT t.id INTO v_envio_oc_broker_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'Envío OC Broker';
      
      -- Obtener el ID de la tarea de flujo para Envío OC Broker
      SELECT id INTO v_envio_oc_broker_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_envio_oc_broker_task_id;
      
      -- Si la tarea existe, actualizar su fecha de inicio
      IF v_envio_oc_broker_flow_task_id IS NOT NULL THEN
        -- Actualizar la tarea directamente (trigger está desactivado)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_envio_oc_broker_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para la automatización de Envío OC Broker
DROP TRIGGER IF EXISTS on_vb_gerente_general_completion ON commission_flow_tasks;
CREATE TRIGGER on_vb_gerente_general_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_vb_gerente_general_completion();

-- Actualizar tareas existentes para mantener la consistencia
DO $$
DECLARE
  v_flow record;
  v_vb_oc_gerencia_general_task_id uuid;
  v_vb_oc_gerencia_general_flow_task_id uuid;
  v_vb_oc_gerencia_general_completed_at timestamptz;
  v_envio_oc_broker_task_id uuid;
  v_envio_oc_broker_flow_task_id uuid;
BEGIN
  -- Para cada flujo de comisión en progreso
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Obtener la tarea VB OC Gerencia General
    SELECT pft.id, cft.id, cft.completed_at 
    INTO v_vb_oc_gerencia_general_task_id, v_vb_oc_gerencia_general_flow_task_id, v_vb_oc_gerencia_general_completed_at
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Orden de Compra'
    AND pft.name = 'VB OC Gerencia General'
    AND cft.status = 'completed';
    
    -- Si se encontró la tarea completada
    IF v_vb_oc_gerencia_general_task_id IS NOT NULL AND v_vb_oc_gerencia_general_completed_at IS NOT NULL THEN
      -- Obtener la tarea Envío OC Broker
      SELECT pft.id, cft.id 
      INTO v_envio_oc_broker_task_id, v_envio_oc_broker_flow_task_id
      FROM payment_flow_tasks pft
      JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
      LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
      WHERE pfs.flow_id = v_flow.flow_id
      AND pfs.name = 'Orden de Compra'
      AND pft.name = 'Envío OC Broker';
      
      -- Si la tarea existe, actualizar su fecha de inicio
      IF v_envio_oc_broker_flow_task_id IS NOT NULL THEN
        -- Actualizar la tarea directamente (trigger está desactivado)
        UPDATE commission_flow_tasks
        SET started_at = v_vb_oc_gerencia_general_completed_at
        WHERE id = v_envio_oc_broker_flow_task_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Re-habilitar el trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;