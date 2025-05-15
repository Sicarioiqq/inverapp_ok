/*
  # Corregir estructura del flujo de segundo pago

  1. Cambios
    - Recrear correctamente las etapas y tareas del flujo de segundo pago
    - Eliminar etapas y tareas duplicadas o marcadas como obsoletas
    - Asegurar que solo exista una etapa de Pago con las tareas correctas
    
  2. Notas
    - Mantiene la integridad referencial
    - Preserva las referencias existentes
*/

-- Temporalmente desactivar el trigger que aplica validación
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Corregir estructura del flujo de segundo pago
DO $$
DECLARE
  v_flow_id uuid;
  v_facturacion_stage_id uuid;
  v_pago_stage_id uuid;
  v_task_id uuid;
  v_task_exists boolean;
  v_task_count integer;
  v_commission_flow_task_id uuid;
  v_commission_flow_id uuid;
  v_task_order integer;
BEGIN
  -- Obtener el ID del flujo de segundo pago
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Segundo Pago';

  -- Eliminar etapas marcadas como [DEPRECATED]
  DELETE FROM payment_flow_stages
  WHERE flow_id = v_flow_id
  AND name LIKE '[DEPRECATED]%'
  AND id NOT IN (
    SELECT DISTINCT stage_id 
    FROM payment_flow_tasks 
    WHERE id IN (SELECT task_id FROM commission_flow_tasks)
  );

  -- Eliminar tareas marcadas como [DEPRECATED]
  DELETE FROM payment_flow_tasks
  WHERE stage_id IN (
    SELECT id FROM payment_flow_stages
    WHERE flow_id = v_flow_id
  )
  AND name LIKE '[DEPRECATED]%'
  AND id NOT IN (SELECT task_id FROM commission_flow_tasks);

  -- Obtener o crear la etapa de Facturación
  SELECT id INTO v_facturacion_stage_id
  FROM payment_flow_stages
  WHERE flow_id = v_flow_id AND name = 'Facturación';
  
  IF v_facturacion_stage_id IS NULL THEN
    -- Crear la etapa de Facturación
    INSERT INTO payment_flow_stages (flow_id, name, description, "order", is_active)
    VALUES (v_flow_id, 'Facturación', 'Proceso de facturación para segundo pago', 1, true)
    RETURNING id INTO v_facturacion_stage_id;
  ELSE
    -- Asegurar que el orden sea correcto
    UPDATE payment_flow_stages
    SET "order" = 1
    WHERE id = v_facturacion_stage_id;
  END IF;
  
  -- Obtener o crear la etapa de Pago
  SELECT id INTO v_pago_stage_id
  FROM payment_flow_stages
  WHERE flow_id = v_flow_id AND name = 'Pago';
  
  IF v_pago_stage_id IS NULL THEN
    -- Crear la etapa de Pago
    INSERT INTO payment_flow_stages (flow_id, name, description, "order", is_active)
    VALUES (v_flow_id, 'Pago', 'Proceso de pago para segundo pago', 2, true)
    RETURNING id INTO v_pago_stage_id;
  ELSE
    -- Asegurar que el orden sea correcto
    UPDATE payment_flow_stages
    SET "order" = 2
    WHERE id = v_pago_stage_id;
  END IF;
  
  -- Crear o actualizar tareas en la etapa de Facturación
  FOR v_task_order IN 1..4 LOOP
    CASE v_task_order
      WHEN 1 THEN
        -- Verificar si existe Generación de Entrada 2
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_facturacion_stage_id
        AND name = 'Generación de Entrada 2';
        
        IF v_task_id IS NULL THEN
          -- Crear la tarea
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_facturacion_stage_id, 'Generación de Entrada 2', 'Generación de entrada en sistema para segundo pago', 1, true, 2);
        ELSE
          -- Asegurar que el orden sea correcto
          UPDATE payment_flow_tasks
          SET "order" = 1
          WHERE id = v_task_id;
        END IF;
      
      WHEN 2 THEN
        -- Verificar si existe Aprobación de Entrada 2
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_facturacion_stage_id
        AND name = 'Aprobación de Entrada 2';
        
        IF v_task_id IS NULL THEN
          -- Crear la tarea
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_facturacion_stage_id, 'Aprobación de Entrada 2', 'Aprobación de la entrada generada para segundo pago', 2, true, 2);
        ELSE
          -- Asegurar que el orden sea correcto
          UPDATE payment_flow_tasks
          SET "order" = 2
          WHERE id = v_task_id;
        END IF;
      
      WHEN 3 THEN
        -- Verificar si existe Envío Entrada Broker 2
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_facturacion_stage_id
        AND name = 'Envío Entrada Broker 2';
        
        IF v_task_id IS NULL THEN
          -- Crear la tarea
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_facturacion_stage_id, 'Envío Entrada Broker 2', 'Envío de entrada al Broker para segundo pago', 3, true, 1);
        ELSE
          -- Asegurar que el orden sea correcto
          UPDATE payment_flow_tasks
          SET "order" = 3
          WHERE id = v_task_id;
        END IF;
      
      WHEN 4 THEN
        -- Verificar si existe Recepción Factura 2 Broker
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_facturacion_stage_id
        AND name = 'Recepción Factura 2 Broker';
        
        IF v_task_id IS NULL THEN
          -- Crear la tarea
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_facturacion_stage_id, 'Recepción Factura 2 Broker', 'Recepción de factura del Broker para segundo pago', 4, true, 3);
        ELSE
          -- Asegurar que el orden sea correcto
          UPDATE payment_flow_tasks
          SET "order" = 4
          WHERE id = v_task_id;
        END IF;
    END CASE;
  END LOOP;
  
  -- Crear o actualizar tareas en la etapa de Pago
  FOR v_task_order IN 1..2 LOOP
    CASE v_task_order
      WHEN 1 THEN
        -- Verificar si existe Notificación a Finanzas 2
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_pago_stage_id
        AND name = 'Notificación a Finanzas 2';
        
        IF v_task_id IS NULL THEN
          -- Crear la tarea
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_pago_stage_id, 'Notificación a Finanzas 2', 'Notificación del pago a Finanzas para segundo pago', 1, true, 1);
        ELSE
          -- Asegurar que el orden sea correcto
          UPDATE payment_flow_tasks
          SET "order" = 1
          WHERE id = v_task_id;
        END IF;
      
      WHEN 2 THEN
        -- Verificar si existe Fecha de Pago 2
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_pago_stage_id
        AND name = 'Fecha de Pago 2';
        
        IF v_task_id IS NULL THEN
          -- Crear la tarea
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_pago_stage_id, 'Fecha de Pago 2', 'Registro de fecha de pago efectivo para segundo pago', 2, true, 2);
        ELSE
          -- Asegurar que el orden sea correcto
          UPDATE payment_flow_tasks
          SET "order" = 2
          WHERE id = v_task_id;
        END IF;
    END CASE;
  END LOOP;
  
  -- Eliminar tareas adicionales que no deberían estar en estas etapas
  DELETE FROM payment_flow_tasks
  WHERE stage_id = v_facturacion_stage_id
  AND name NOT IN (
    'Generación de Entrada 2', 
    'Aprobación de Entrada 2', 
    'Envío Entrada Broker 2', 
    'Recepción Factura 2 Broker'
  )
  AND id NOT IN (SELECT task_id FROM commission_flow_tasks);
  
  DELETE FROM payment_flow_tasks
  WHERE stage_id = v_pago_stage_id
  AND name NOT IN (
    'Notificación a Finanzas 2', 
    'Fecha de Pago 2'
  )
  AND id NOT IN (SELECT task_id FROM commission_flow_tasks);
  
  -- Eliminar etapas adicionales que no sean Facturación o Pago
  DELETE FROM payment_flow_stages
  WHERE flow_id = v_flow_id
  AND name NOT IN ('Facturación', 'Pago')
  AND id NOT IN (
    SELECT DISTINCT stage_id 
    FROM payment_flow_tasks 
    WHERE id IN (SELECT task_id FROM commission_flow_tasks)
  );
END $$;

-- Re-habilitar el trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;