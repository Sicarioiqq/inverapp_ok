/*
  # Automatización de fechas en tareas de Pago

  1. Nuevas Funcionalidades
    - Establecer la fecha de inicio de "Notificación a Finanzas" igual a la fecha de completado de "Aprobación de Entrada"
    - Establecer la fecha de inicio de "Fecha de Pago" igual a la fecha de completado de "Notificación a Finanzas"
    
  2. Cambios
    - Crear funciones para manejar la lógica de automatización de cada tarea
    - Crear triggers para detectar cambios en las tareas correspondientes
    - Actualizar tareas existentes para mantener la consistencia
    
  3. Seguridad
    - Mantener las políticas RLS existentes
*/

-- Temporalmente desactivar el trigger que aplica validación
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Función para manejar la automatización de Notificación a Finanzas
CREATE OR REPLACE FUNCTION handle_aprobacion_entrada_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_notificacion_finanzas_task_id uuid;
  v_notificacion_finanzas_flow_task_id uuid;
BEGIN
  -- Solo proceder si la tarea está siendo completada o si la fecha de completado cambió
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Obtener el ID del flujo
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Verificar si esta es la tarea Aprobación de Entrada
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Facturación'
      AND t.name = 'Aprobación de Entrada'
    ) THEN
      -- Obtener el ID de la tarea Notificación a Finanzas
      SELECT t.id INTO v_notificacion_finanzas_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Pago'
      AND t.name = 'Notificación a Finanzas';
      
      -- Obtener el ID de la tarea de flujo para Notificación a Finanzas
      SELECT id INTO v_notificacion_finanzas_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_notificacion_finanzas_task_id;
      
      -- Si la tarea existe, actualizar su fecha de inicio
      IF v_notificacion_finanzas_flow_task_id IS NOT NULL THEN
        -- Actualizar la tarea directamente (trigger está desactivado)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_notificacion_finanzas_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para la automatización de Notificación a Finanzas
DROP TRIGGER IF EXISTS on_aprobacion_entrada_completion ON commission_flow_tasks;
CREATE TRIGGER on_aprobacion_entrada_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_aprobacion_entrada_completion();

-- Función para manejar la automatización de Fecha de Pago
CREATE OR REPLACE FUNCTION handle_notificacion_finanzas_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_fecha_pago_task_id uuid;
  v_fecha_pago_flow_task_id uuid;
BEGIN
  -- Solo proceder si la tarea está siendo completada o si la fecha de completado cambió
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Obtener el ID del flujo
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Verificar si esta es la tarea Notificación a Finanzas
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Pago'
      AND t.name = 'Notificación a Finanzas'
    ) THEN
      -- Obtener el ID de la tarea Fecha de Pago
      SELECT t.id INTO v_fecha_pago_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Pago'
      AND t.name = 'Fecha de Pago';
      
      -- Obtener el ID de la tarea de flujo para Fecha de Pago
      SELECT id INTO v_fecha_pago_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_fecha_pago_task_id;
      
      -- Si la tarea existe, actualizar su fecha de inicio
      IF v_fecha_pago_flow_task_id IS NOT NULL THEN
        -- Actualizar la tarea directamente (trigger está desactivado)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_fecha_pago_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para la automatización de Fecha de Pago
DROP TRIGGER IF EXISTS on_notificacion_finanzas_completion ON commission_flow_tasks;
CREATE TRIGGER on_notificacion_finanzas_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_notificacion_finanzas_completion();

-- Actualizar tareas existentes para mantener la consistencia
DO $$
DECLARE
  v_flow record;
  v_task_pairs record;
  v_source_task_id uuid;
  v_source_flow_task_id uuid;
  v_source_completed_at timestamptz;
  v_target_task_id uuid;
  v_target_flow_task_id uuid;
BEGIN
  -- Define task pairs to synchronize (source task -> target task)
  FOR v_task_pairs IN (
    SELECT 
      source_stage.name as source_stage_name,
      source_task.name as source_task_name,
      target_stage.name as target_stage_name,
      target_task.name as target_task_name
    FROM (VALUES
      ('Facturación', 'Aprobación de Entrada', 'Pago', 'Notificación a Finanzas'),
      ('Pago', 'Notificación a Finanzas', 'Pago', 'Fecha de Pago')
    ) AS pairs(source_stage_name, source_task_name, target_stage_name, target_task_name)
    JOIN payment_flow_stages source_stage ON source_stage.name = pairs.source_stage_name
    JOIN payment_flow_tasks source_task ON source_task.stage_id = source_stage.id AND source_task.name = pairs.source_task_name
    JOIN payment_flow_stages target_stage ON target_stage.name = pairs.target_stage_name AND target_stage.flow_id = source_stage.flow_id
    JOIN payment_flow_tasks target_task ON target_task.stage_id = target_stage.id AND target_task.name = pairs.target_task_name
  ) LOOP
    -- For each commission flow
    FOR v_flow IN 
      SELECT cf.id, cf.flow_id
      FROM commission_flows cf
      WHERE cf.status = 'in_progress'
    LOOP
      -- Get source task
      SELECT pft.id, cft.id, cft.completed_at 
      INTO v_source_task_id, v_source_flow_task_id, v_source_completed_at
      FROM payment_flow_tasks pft
      JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
      LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
      WHERE pfs.flow_id = v_flow.flow_id
      AND pfs.name = v_task_pairs.source_stage_name
      AND pft.name = v_task_pairs.source_task_name
      AND cft.status = 'completed';
      
      -- If found completed source task
      IF v_source_task_id IS NOT NULL AND v_source_completed_at IS NOT NULL THEN
        -- Get target task
        SELECT pft.id, cft.id 
        INTO v_target_task_id, v_target_flow_task_id
        FROM payment_flow_tasks pft
        JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
        LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
        WHERE pfs.flow_id = v_flow.flow_id
        AND pfs.name = v_task_pairs.target_stage_name
        AND pft.name = v_task_pairs.target_task_name;
        
        -- If target task exists, update its start date
        IF v_target_flow_task_id IS NOT NULL THEN
          -- Update the task directly (trigger is disabled)
          UPDATE commission_flow_tasks
          SET started_at = v_source_completed_at
          WHERE id = v_target_flow_task_id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Re-habilitar el trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;