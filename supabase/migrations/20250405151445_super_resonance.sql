/*
  # Eliminar todos los datos relacionados con segundo pago

  1. Cambios
    - Eliminar flujos de comisión marcados como segundo pago
    - Eliminar tareas de flujo de comisión asociadas a segundo pago
    - Limpiar tareas y etapas con nombres relacionados a segundo pago
    - Mantener la integridad referencial de la base de datos
    
  2. Notas
    - Se preservan las referencias existentes
    - Se eliminan datos que podrían causar duplicación en la UI
*/

-- Temporalmente desactivar el trigger que aplica validación
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Eliminar datos relacionados con segundo pago
DO $$
DECLARE
  v_flow_id uuid;
  v_second_payment_flows record;
  v_task_id uuid;
  v_stage_id uuid;
BEGIN
  -- Obtener el ID del flujo de segundo pago
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Segundo Pago';

  -- 1. Eliminar flujos de comisión marcados como segundo pago
  -- Primero, eliminar las tareas de flujo de comisión asociadas
  FOR v_second_payment_flows IN 
    SELECT id
    FROM commission_flows
    WHERE is_second_payment = true
  LOOP
    -- Eliminar comentarios de tareas
    DELETE FROM commission_task_comments
    WHERE commission_flow_task_id IN (
      SELECT id FROM commission_flow_tasks
      WHERE commission_flow_id = v_second_payment_flows.id
    );
    
    -- Eliminar tareas
    DELETE FROM commission_flow_tasks
    WHERE commission_flow_id = v_second_payment_flows.id;
    
    -- Eliminar el flujo
    DELETE FROM commission_flows
    WHERE id = v_second_payment_flows.id;
  END LOOP;

  -- 2. Limpiar tareas con "2" en el nombre en el flujo de segundo pago
  -- Primero, identificar las tareas
  FOR v_task_id IN 
    SELECT t.id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow_id
    AND (
      t.name LIKE '%2' OR 
      t.name LIKE '%2%' OR 
      t.name LIKE '[DEPRECATED]%'
    )
    AND t.id NOT IN (SELECT task_id FROM commission_flow_tasks)
  LOOP
    -- Eliminar tareas que no están referenciadas
    DELETE FROM payment_flow_tasks
    WHERE id = v_task_id;
  END LOOP;

  -- 3. Limpiar etapas marcadas como [DEPRECATED]
  FOR v_stage_id IN 
    SELECT id
    FROM payment_flow_stages
    WHERE flow_id = v_flow_id
    AND name LIKE '[DEPRECATED]%'
    AND id NOT IN (
      SELECT DISTINCT stage_id 
      FROM payment_flow_tasks 
      WHERE id IN (SELECT task_id FROM commission_flow_tasks)
    )
  LOOP
    -- Eliminar etapas que no tienen tareas referenciadas
    DELETE FROM payment_flow_stages
    WHERE id = v_stage_id;
  END LOOP;

  -- 4. Asegurar que solo hay una etapa de Pago en el flujo de segundo pago
  -- Primero, encontrar todas las etapas de Pago
  FOR v_stage_id IN 
    SELECT id
    FROM payment_flow_stages
    WHERE flow_id = v_flow_id
    AND name = 'Pago'
    ORDER BY "order"
    OFFSET 1  -- Mantener la primera, eliminar las demás
  LOOP
    -- Verificar si hay tareas referenciadas
    IF NOT EXISTS (
      SELECT 1 
      FROM payment_flow_tasks 
      WHERE stage_id = v_stage_id
      AND id IN (SELECT task_id FROM commission_flow_tasks)
    ) THEN
      -- Eliminar tareas no referenciadas
      DELETE FROM payment_flow_tasks
      WHERE stage_id = v_stage_id;
      
      -- Eliminar la etapa
      DELETE FROM payment_flow_stages
      WHERE id = v_stage_id;
    ELSE
      -- Marcar como obsoleta si no se puede eliminar
      UPDATE payment_flow_stages
      SET name = '[DEPRECATED] Pago',
          description = 'Esta etapa ha sido reemplazada y no debe usarse'
      WHERE id = v_stage_id;
    END IF;
  END LOOP;

  -- 5. Limpiar payment_2_date en broker_commissions
  UPDATE broker_commissions
  SET payment_2_date = NULL,
      invoice_2 = NULL,
      invoice_2_date = NULL;
END $$;

-- Re-habilitar el trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;