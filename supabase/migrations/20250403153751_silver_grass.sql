/*
  # Automatización de Orden de Compra basada en VB Gerente Comercial y VB Operaciones

  1. Nuevas Funcionalidades
    - Automatizar la fecha de inicio de Generación de OC basada en la fecha más reciente entre VB Gerente Comercial y VB Operaciones
    - Asignar automáticamente la tarea Generación de OC cuando VB Control de Gestión tiene más de 3 días de atraso
    - Mantener la sincronización de fechas entre tareas relacionadas
    
  2. Cambios
    - Crear función para manejar la lógica de automatización de Generación de OC
    - Crear triggers para detectar cambios en VB Gerente Comercial y VB Operaciones
    - Implementar lógica para calcular atrasos en VB Control de Gestión
    
  3. Seguridad
    - Mantener las políticas RLS existentes
*/

-- Temporalmente desactivar el trigger que aplica validación
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Función para verificar si una tarea está atrasada
CREATE OR REPLACE FUNCTION is_task_overdue(
  p_task_id uuid,
  p_commission_flow_id uuid,
  p_days_threshold integer
) RETURNS boolean AS $$
DECLARE
  v_task_record record;
  v_days_elapsed integer;
BEGIN
  -- Obtener información de la tarea
  SELECT 
    cft.started_at,
    cft.status,
    pft.days_to_complete
  INTO v_task_record
  FROM commission_flow_tasks cft
  JOIN payment_flow_tasks pft ON pft.id = cft.task_id
  WHERE cft.commission_flow_id = p_commission_flow_id
  AND cft.task_id = p_task_id;
  
  -- Si la tarea no existe o ya está completada, no está atrasada
  IF v_task_record IS NULL OR v_task_record.status = 'completed' THEN
    RETURN false;
  END IF;
  
  -- Si la tarea no tiene fecha de inicio, no podemos calcular el atraso
  IF v_task_record.started_at IS NULL THEN
    RETURN false;
  END IF;
  
  -- Calcular los días transcurridos desde el inicio de la tarea
  v_days_elapsed := EXTRACT(DAY FROM (now() - v_task_record.started_at));
  
  -- Determinar si la tarea está atrasada según el umbral proporcionado
  -- Si no hay days_to_complete definido, usar el umbral directamente
  IF v_task_record.days_to_complete IS NOT NULL THEN
    RETURN v_days_elapsed > (v_task_record.days_to_complete + p_days_threshold);
  ELSE
    RETURN v_days_elapsed > p_days_threshold;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Función para manejar la automatización de Generación de OC
CREATE OR REPLACE FUNCTION handle_generacion_oc_automation()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_gerente_task_id uuid;
  v_vb_gerente_flow_task_id uuid;
  v_vb_gerente_completed_at timestamptz;
  v_vb_operaciones_task_id uuid;
  v_vb_operaciones_flow_task_id uuid;
  v_vb_operaciones_completed_at timestamptz;
  v_vb_control_gestion_task_id uuid;
  v_vb_control_gestion_flow_task_id uuid;
  v_generacion_oc_task_id uuid;
  v_generacion_oc_flow_task_id uuid;
  v_generacion_oc_status text;
  v_latest_completion_date timestamptz;
  v_control_gestion_overdue boolean;
  v_default_assignee_id uuid;
BEGIN
  -- Obtener el ID del flujo
  SELECT flow_id INTO v_flow_id
  FROM commission_flows
  WHERE id = NEW.commission_flow_id;
  
  -- Obtener IDs de tareas relevantes
  SELECT t.id INTO v_vb_gerente_task_id
  FROM payment_flow_tasks t
  JOIN payment_flow_stages s ON s.id = t.stage_id
  WHERE s.flow_id = v_flow_id
  AND s.name = 'Aprobación Gerente Comercial'
  AND t.name = 'VB Gerente Comercial';
  
  SELECT t.id INTO v_vb_operaciones_task_id
  FROM payment_flow_tasks t
  JOIN payment_flow_stages s ON s.id = t.stage_id
  WHERE s.flow_id = v_flow_id
  AND s.name = 'Aprobación Operaciones'
  AND t.name = 'VB Operaciones';
  
  SELECT t.id INTO v_vb_control_gestion_task_id
  FROM payment_flow_tasks t
  JOIN payment_flow_stages s ON s.id = t.stage_id
  WHERE s.flow_id = v_flow_id
  AND s.name = 'Aprobación Control de Gestión'
  AND t.name = 'VB Control de Gestión';
  
  SELECT t.id, t.default_assignee_id INTO v_generacion_oc_task_id, v_default_assignee_id
  FROM payment_flow_tasks t
  JOIN payment_flow_stages s ON s.id = t.stage_id
  WHERE s.flow_id = v_flow_id
  AND s.name = 'Orden de Compra'
  AND t.name = 'Generación de OC';
  
  -- Obtener estado actual de las tareas
  SELECT 
    cft.id, 
    cft.completed_at 
  INTO v_vb_gerente_flow_task_id, v_vb_gerente_completed_at
  FROM commission_flow_tasks cft
  WHERE cft.commission_flow_id = NEW.commission_flow_id
  AND cft.task_id = v_vb_gerente_task_id
  AND cft.status = 'completed';
  
  SELECT 
    cft.id, 
    cft.completed_at 
  INTO v_vb_operaciones_flow_task_id, v_vb_operaciones_completed_at
  FROM commission_flow_tasks cft
  WHERE cft.commission_flow_id = NEW.commission_flow_id
  AND cft.task_id = v_vb_operaciones_task_id
  AND cft.status = 'completed';
  
  SELECT 
    cft.id
  INTO v_vb_control_gestion_flow_task_id
  FROM commission_flow_tasks cft
  WHERE cft.commission_flow_id = NEW.commission_flow_id
  AND cft.task_id = v_vb_control_gestion_task_id;
  
  SELECT 
    cft.id,
    cft.status
  INTO v_generacion_oc_flow_task_id, v_generacion_oc_status
  FROM commission_flow_tasks cft
  WHERE cft.commission_flow_id = NEW.commission_flow_id
  AND cft.task_id = v_generacion_oc_task_id;
  
  -- Verificar si VB Control de Gestión está atrasado (más de 3 días)
  v_control_gestion_overdue := is_task_overdue(v_vb_control_gestion_task_id, NEW.commission_flow_id, 3);
  
  -- Solo proceder si ambas tareas (VB Gerente Comercial y VB Operaciones) están completadas
  -- o si VB Control de Gestión está atrasado por más de 3 días
  IF (v_vb_gerente_completed_at IS NOT NULL AND v_vb_operaciones_completed_at IS NOT NULL) OR v_control_gestion_overdue THEN
    -- Determinar la fecha de completado más reciente entre VB Gerente Comercial y VB Operaciones
    IF v_vb_gerente_completed_at IS NOT NULL AND v_vb_operaciones_completed_at IS NOT NULL THEN
      IF v_vb_gerente_completed_at > v_vb_operaciones_completed_at THEN
        v_latest_completion_date := v_vb_gerente_completed_at;
      ELSE
        v_latest_completion_date := v_vb_operaciones_completed_at;
      END IF;
    ELSIF v_vb_gerente_completed_at IS NOT NULL THEN
      v_latest_completion_date := v_vb_gerente_completed_at;
    ELSIF v_vb_operaciones_completed_at IS NOT NULL THEN
      v_latest_completion_date := v_vb_operaciones_completed_at;
    ELSE
      v_latest_completion_date := now(); -- Si ninguna está completada pero hay atraso, usar fecha actual
    END IF;
    
    -- Si la tarea Generación de OC existe y no está en estado pendiente o en progreso
    IF v_generacion_oc_flow_task_id IS NOT NULL AND v_generacion_oc_status = 'blocked' THEN
      -- Actualizar la tarea directamente (trigger está desactivado)
      UPDATE commission_flow_tasks
      SET 
        started_at = v_latest_completion_date,
        status = 'pending',
        assignee_id = CASE 
          WHEN v_control_gestion_overdue THEN v_default_assignee_id
          ELSE assignee_id
        END,
        assigned_at = CASE 
          WHEN v_control_gestion_overdue AND v_default_assignee_id IS NOT NULL THEN now()
          ELSE assigned_at
        END
      WHERE id = v_generacion_oc_flow_task_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para la automatización de Generación de OC
DROP TRIGGER IF EXISTS on_vb_gerente_operaciones_completion ON commission_flow_tasks;
CREATE TRIGGER on_vb_gerente_operaciones_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_generacion_oc_automation();

-- Función para verificar periódicamente tareas atrasadas y actualizar Generación de OC
CREATE OR REPLACE FUNCTION check_overdue_tasks_and_update_oc()
RETURNS void AS $$
DECLARE
  v_flow record;
  v_vb_gerente_task_id uuid;
  v_vb_gerente_flow_task_id uuid;
  v_vb_gerente_completed_at timestamptz;
  v_vb_operaciones_task_id uuid;
  v_vb_operaciones_flow_task_id uuid;
  v_vb_operaciones_completed_at timestamptz;
  v_vb_control_gestion_task_id uuid;
  v_vb_control_gestion_flow_task_id uuid;
  v_generacion_oc_task_id uuid;
  v_generacion_oc_flow_task_id uuid;
  v_generacion_oc_status text;
  v_latest_completion_date timestamptz;
  v_control_gestion_overdue boolean;
  v_default_assignee_id uuid;
BEGIN
  -- Para cada flujo de comisión en progreso
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Obtener IDs de tareas relevantes
    SELECT t.id INTO v_vb_gerente_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Aprobación Gerente Comercial'
    AND t.name = 'VB Gerente Comercial';
    
    SELECT t.id INTO v_vb_operaciones_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Aprobación Operaciones'
    AND t.name = 'VB Operaciones';
    
    SELECT t.id INTO v_vb_control_gestion_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Aprobación Control de Gestión'
    AND t.name = 'VB Control de Gestión';
    
    SELECT t.id, t.default_assignee_id INTO v_generacion_oc_task_id, v_default_assignee_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Orden de Compra'
    AND t.name = 'Generación de OC';
    
    -- Obtener estado actual de las tareas
    SELECT 
      cft.id, 
      cft.completed_at 
    INTO v_vb_gerente_flow_task_id, v_vb_gerente_completed_at
    FROM commission_flow_tasks cft
    WHERE cft.commission_flow_id = v_flow.id
    AND cft.task_id = v_vb_gerente_task_id
    AND cft.status = 'completed';
    
    SELECT 
      cft.id, 
      cft.completed_at 
    INTO v_vb_operaciones_flow_task_id, v_vb_operaciones_completed_at
    FROM commission_flow_tasks cft
    WHERE cft.commission_flow_id = v_flow.id
    AND cft.task_id = v_vb_operaciones_task_id
    AND cft.status = 'completed';
    
    SELECT 
      cft.id
    INTO v_vb_control_gestion_flow_task_id
    FROM commission_flow_tasks cft
    WHERE cft.commission_flow_id = v_flow.id
    AND cft.task_id = v_vb_control_gestion_task_id;
    
    SELECT 
      cft.id,
      cft.status
    INTO v_generacion_oc_flow_task_id, v_generacion_oc_status
    FROM commission_flow_tasks cft
    WHERE cft.commission_flow_id = v_flow.id
    AND cft.task_id = v_generacion_oc_task_id;
    
    -- Verificar si VB Control de Gestión está atrasado (más de 3 días)
    v_control_gestion_overdue := is_task_overdue(v_vb_control_gestion_task_id, v_flow.id, 3);
    
    -- Solo proceder si ambas tareas (VB Gerente Comercial y VB Operaciones) están completadas
    -- o si VB Control de Gestión está atrasado por más de 3 días
    IF (v_vb_gerente_completed_at IS NOT NULL AND v_vb_operaciones_completed_at IS NOT NULL) OR v_control_gestion_overdue THEN
      -- Determinar la fecha de completado más reciente entre VB Gerente Comercial y VB Operaciones
      IF v_vb_gerente_completed_at IS NOT NULL AND v_vb_operaciones_completed_at IS NOT NULL THEN
        IF v_vb_gerente_completed_at > v_vb_operaciones_completed_at THEN
          v_latest_completion_date := v_vb_gerente_completed_at;
        ELSE
          v_latest_completion_date := v_vb_operaciones_completed_at;
        END IF;
      ELSIF v_vb_gerente_completed_at IS NOT NULL THEN
        v_latest_completion_date := v_vb_gerente_completed_at;
      ELSIF v_vb_operaciones_completed_at IS NOT NULL THEN
        v_latest_completion_date := v_vb_operaciones_completed_at;
      ELSE
        v_latest_completion_date := now(); -- Si ninguna está completada pero hay atraso, usar fecha actual
      END IF;
      
      -- Si la tarea Generación de OC existe y no está en estado pendiente o en progreso
      IF v_generacion_oc_flow_task_id IS NOT NULL AND v_generacion_oc_status = 'blocked' THEN
        -- Actualizar la tarea directamente (trigger está desactivado)
        UPDATE commission_flow_tasks
        SET 
          started_at = v_latest_completion_date,
          status = 'pending',
          assignee_id = CASE 
            WHEN v_control_gestion_overdue THEN v_default_assignee_id
            ELSE assignee_id
          END,
          assigned_at = CASE 
            WHEN v_control_gestion_overdue AND v_default_assignee_id IS NOT NULL THEN now()
            ELSE assigned_at
          END
        WHERE id = v_generacion_oc_flow_task_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la función para actualizar las tareas existentes
SELECT check_overdue_tasks_and_update_oc();

-- Re-habilitar el trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;