/*
  # Fix duplicate Pago stage in second payment flow

  1. Changes
    - Identify and fix duplicate Pago stages in the second payment flow
    - Ensure tasks are properly assigned to the correct stage
    - Maintain existing task references and data integrity
    
  2. Notes
    - Preserves existing task relationships
    - Improves UI display by removing duplicates
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Fix duplicate Pago stages in second payment flow
DO $$
DECLARE
  v_flow_id uuid;
  v_pago_stages record;
  v_primary_pago_stage_id uuid;
  v_task_id uuid;
  v_task_exists boolean;
  v_task_count integer;
  v_commission_flow_task_id uuid;
BEGIN
  -- Get the ID of the second payment flow
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Segundo Pago';

  -- Find all Pago stages in the second payment flow
  FOR v_pago_stages IN 
    SELECT id, "order"
    FROM payment_flow_stages
    WHERE flow_id = v_flow_id AND name = 'Pago'
    ORDER BY "order"
  LOOP
    -- The first one we find will be our primary stage
    IF v_primary_pago_stage_id IS NULL THEN
      v_primary_pago_stage_id := v_pago_stages.id;
    ELSE
      -- For any additional Pago stages, move their tasks to the primary stage
      -- and then mark the duplicate stage
      
      -- First, check if there are any tasks in this stage
      SELECT COUNT(*) INTO v_task_count
      FROM payment_flow_tasks
      WHERE stage_id = v_pago_stages.id;
      
      IF v_task_count > 0 THEN
        -- For each task in the duplicate stage
        FOR v_task_id IN 
          SELECT id
          FROM payment_flow_tasks
          WHERE stage_id = v_pago_stages.id
        LOOP
          -- Check if this task is referenced by any commission_flow_tasks
          SELECT EXISTS (
            SELECT 1 FROM commission_flow_tasks
            WHERE task_id = v_task_id
          ) INTO v_task_exists;
          
          IF v_task_exists THEN
            -- If the task is referenced, mark it as deprecated
            UPDATE payment_flow_tasks
            SET name = CASE 
                  WHEN name NOT LIKE '[DEPRECATED]%' THEN '[DEPRECATED] ' || name
                  ELSE name
                END,
                description = 'Esta tarea ha sido reemplazada y no debe usarse'
            WHERE id = v_task_id;
          ELSE
            -- If the task is not referenced, we can safely delete it
            DELETE FROM payment_flow_tasks
            WHERE id = v_task_id;
          END IF;
        END LOOP;
      END IF;
      
      -- Instead of deleting the stage, rename it to mark it as deprecated
      -- This avoids foreign key constraint violations
      UPDATE payment_flow_stages
      SET name = '[DEPRECATED] Pago',
          description = 'Esta etapa ha sido reemplazada y no debe usarse'
      WHERE id = v_pago_stages.id;
    END IF;
  END LOOP;
  
  -- Ensure the primary Pago stage has the correct tasks
  -- Check if "Notificación a Finanzas 2" exists
  SELECT id INTO v_task_id
  FROM payment_flow_tasks
  WHERE stage_id = v_primary_pago_stage_id
  AND name = 'Notificación a Finanzas 2';
  
  IF v_task_id IS NULL THEN
    -- Create the task
    INSERT INTO payment_flow_tasks (
      stage_id, 
      name, 
      description, 
      "order", 
      is_required, 
      days_to_complete
    ) VALUES (
      v_primary_pago_stage_id,
      'Notificación a Finanzas 2',
      'Notificación del pago a Finanzas para segundo pago',
      1,
      true,
      1
    );
  ELSE
    -- Ensure the order is correct
    UPDATE payment_flow_tasks
    SET "order" = 1
    WHERE id = v_task_id;
  END IF;
  
  -- Check if "Fecha de Pago 2" exists
  SELECT id INTO v_task_id
  FROM payment_flow_tasks
  WHERE stage_id = v_primary_pago_stage_id
  AND name = 'Fecha de Pago 2';
  
  IF v_task_id IS NULL THEN
    -- Create the task
    INSERT INTO payment_flow_tasks (
      stage_id, 
      name, 
      description, 
      "order", 
      is_required, 
      days_to_complete
    ) VALUES (
      v_primary_pago_stage_id,
      'Fecha de Pago 2',
      'Registro de fecha de pago efectivo para segundo pago',
      2,
      true,
      2
    );
  ELSE
    -- Ensure the order is correct
    UPDATE payment_flow_tasks
    SET "order" = 2
    WHERE id = v_task_id;
  END IF;
  
  -- Handle "Aprobación de Entrada 2" in Pago stage if it exists
  SELECT id INTO v_task_id
  FROM payment_flow_tasks
  WHERE stage_id = v_primary_pago_stage_id
  AND name = 'Aprobación de Entrada 2';
  
  IF v_task_id IS NOT NULL THEN
    -- Check if this task is referenced by any commission_flow_tasks
    SELECT EXISTS (
      SELECT 1 FROM commission_flow_tasks
      WHERE task_id = v_task_id
    ) INTO v_task_exists;
    
    IF v_task_exists THEN
      -- If the task is referenced, mark it as deprecated
      UPDATE payment_flow_tasks
      SET name = CASE 
            WHEN name NOT LIKE '[DEPRECATED]%' THEN '[DEPRECATED] ' || name
            ELSE name
          END,
          description = 'Esta tarea ha sido reemplazada y no debe usarse'
      WHERE id = v_task_id;
    ELSE
      -- If the task is not referenced, we can safely delete it
      DELETE FROM payment_flow_tasks
      WHERE id = v_task_id;
    END IF;
  END IF;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;