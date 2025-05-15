-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Update the second payment flow structure
DO $$
DECLARE
  v_flow_id uuid;
  v_facturacion_stage_id uuid;
  v_pago_stage_id uuid;
  v_entrada_stage_id uuid;
  v_task_id uuid;
  v_task_exists boolean;
  v_task_count integer;
  v_commission_flow_task_id uuid;
  v_commission_flow_id uuid;
  v_task_order integer;
BEGIN
  -- Get the ID of the second payment flow
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Segundo Pago';

  -- First, ensure we have exactly two stages: Facturación and Pago
  -- Get or create the Facturación stage
  SELECT id INTO v_facturacion_stage_id
  FROM payment_flow_stages
  WHERE flow_id = v_flow_id AND name = 'Facturación';
  
  IF v_facturacion_stage_id IS NULL THEN
    -- Create the Facturación stage
    INSERT INTO payment_flow_stages (flow_id, name, description, "order", is_active)
    VALUES (v_flow_id, 'Facturación', 'Proceso de facturación para segundo pago', 1, true)
    RETURNING id INTO v_facturacion_stage_id;
  ELSE
    -- Ensure the order is correct
    UPDATE payment_flow_stages
    SET "order" = 1
    WHERE id = v_facturacion_stage_id;
  END IF;
  
  -- Get or create the Pago stage
  SELECT id INTO v_pago_stage_id
  FROM payment_flow_stages
  WHERE flow_id = v_flow_id AND name = 'Pago';
  
  IF v_pago_stage_id IS NULL THEN
    -- Create the Pago stage
    INSERT INTO payment_flow_stages (flow_id, name, description, "order", is_active)
    VALUES (v_flow_id, 'Pago', 'Proceso de pago para segundo pago', 2, true)
    RETURNING id INTO v_pago_stage_id;
  ELSE
    -- Ensure the order is correct
    UPDATE payment_flow_stages
    SET "order" = 2
    WHERE id = v_pago_stage_id;
  END IF;
  
  -- Check if there's an Entrada stage (old structure)
  SELECT id INTO v_entrada_stage_id
  FROM payment_flow_stages
  WHERE flow_id = v_flow_id AND name = 'Entrada';
  
  -- If Entrada stage exists, we need to move its tasks to Facturación before deleting it
  IF v_entrada_stage_id IS NOT NULL THEN
    -- First, update any tasks in the Entrada stage to be in the Facturación stage
    UPDATE payment_flow_tasks
    SET stage_id = v_facturacion_stage_id
    WHERE stage_id = v_entrada_stage_id
    AND id IN (SELECT task_id FROM commission_flow_tasks);
  END IF;
  
  -- Now handle the tasks in the Facturación stage
  -- First, get the current tasks
  FOR v_task_order IN 1..4 LOOP
    CASE v_task_order
      WHEN 1 THEN
        -- Check if Generación de Entrada 2 exists
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_facturacion_stage_id
        AND name = 'Generación de Entrada 2';
        
        IF v_task_id IS NULL THEN
          -- Create the task
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_facturacion_stage_id, 'Generación de Entrada 2', 'Generación de entrada en sistema para segundo pago', 1, true, 2);
        ELSE
          -- Update the task order
          UPDATE payment_flow_tasks
          SET "order" = 1
          WHERE id = v_task_id;
        END IF;
      
      WHEN 2 THEN
        -- Check if Aprobación de Entrada 2 exists
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_facturacion_stage_id
        AND name = 'Aprobación de Entrada 2';
        
        IF v_task_id IS NULL THEN
          -- Create the task
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_facturacion_stage_id, 'Aprobación de Entrada 2', 'Aprobación de la entrada generada para segundo pago', 2, true, 2);
        ELSE
          -- Update the task order
          UPDATE payment_flow_tasks
          SET "order" = 2
          WHERE id = v_task_id;
        END IF;
      
      WHEN 3 THEN
        -- Check if Envío Entrada Broker 2 exists
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_facturacion_stage_id
        AND name = 'Envío Entrada Broker 2';
        
        IF v_task_id IS NULL THEN
          -- Create the task
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_facturacion_stage_id, 'Envío Entrada Broker 2', 'Envío de entrada al Broker para segundo pago', 3, true, 1);
        ELSE
          -- Update the task order
          UPDATE payment_flow_tasks
          SET "order" = 3
          WHERE id = v_task_id;
        END IF;
      
      WHEN 4 THEN
        -- Check if Recepción Factura 2 Broker exists
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_facturacion_stage_id
        AND name = 'Recepción Factura 2 Broker';
        
        IF v_task_id IS NULL THEN
          -- Create the task
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_facturacion_stage_id, 'Recepción Factura 2 Broker', 'Recepción de factura del Broker para segundo pago', 4, true, 3);
        ELSE
          -- Update the task order
          UPDATE payment_flow_tasks
          SET "order" = 4
          WHERE id = v_task_id;
        END IF;
    END CASE;
  END LOOP;
  
  -- Now handle the tasks in the Pago stage
  FOR v_task_order IN 1..2 LOOP
    CASE v_task_order
      WHEN 1 THEN
        -- Check if Notificación a Finanzas 2 exists
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_pago_stage_id
        AND name = 'Notificación a Finanzas 2';
        
        IF v_task_id IS NULL THEN
          -- Create the task
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_pago_stage_id, 'Notificación a Finanzas 2', 'Notificación del pago a Finanzas para segundo pago', 1, true, 1);
        ELSE
          -- Update the task order
          UPDATE payment_flow_tasks
          SET "order" = 1
          WHERE id = v_task_id;
        END IF;
      
      WHEN 2 THEN
        -- Check if Fecha de Pago 2 exists
        SELECT id INTO v_task_id
        FROM payment_flow_tasks
        WHERE stage_id = v_pago_stage_id
        AND name = 'Fecha de Pago 2';
        
        IF v_task_id IS NULL THEN
          -- Create the task
          INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
          VALUES (v_pago_stage_id, 'Fecha de Pago 2', 'Registro de fecha de pago efectivo para segundo pago', 2, true, 2);
        ELSE
          -- Update the task order
          UPDATE payment_flow_tasks
          SET "order" = 2
          WHERE id = v_task_id;
        END IF;
    END CASE;
  END LOOP;
  
  -- Mark any task that has commission_flow_tasks references as deprecated instead of deleting
  UPDATE payment_flow_tasks
  SET name = CASE 
        WHEN name NOT LIKE '[DEPRECATED]%' THEN '[DEPRECATED] ' || name
        ELSE name
      END,
      description = 'Esta tarea ha sido reemplazada y no debe usarse'
  WHERE stage_id IN (v_facturacion_stage_id, v_pago_stage_id)
  AND name NOT IN (
    'Generación de Entrada 2', 
    'Aprobación de Entrada 2', 
    'Envío Entrada Broker 2', 
    'Recepción Factura 2 Broker', 
    'Notificación a Finanzas 2', 
    'Fecha de Pago 2'
  )
  AND id IN (SELECT task_id FROM commission_flow_tasks);
  
  -- Delete any tasks that don't have references and aren't in our list
  DELETE FROM payment_flow_tasks
  WHERE stage_id IN (v_facturacion_stage_id, v_pago_stage_id)
  AND name NOT IN (
    'Generación de Entrada 2', 
    'Aprobación de Entrada 2', 
    'Envío Entrada Broker 2', 
    'Recepción Factura 2 Broker', 
    'Notificación a Finanzas 2', 
    'Fecha de Pago 2'
  )
  AND name NOT LIKE '[DEPRECATED]%'
  AND id NOT IN (SELECT task_id FROM commission_flow_tasks);
  
  -- Now we can safely delete the Entrada stage if it exists
  IF v_entrada_stage_id IS NOT NULL THEN
    -- Check if there are any tasks left in the Entrada stage
    SELECT COUNT(*) INTO v_task_count
    FROM payment_flow_tasks
    WHERE stage_id = v_entrada_stage_id;
    
    IF v_task_count = 0 THEN
      -- Delete the Entrada stage
      DELETE FROM payment_flow_stages
      WHERE id = v_entrada_stage_id;
    END IF;
  END IF;
  
  -- Delete any other stages that aren't Facturación or Pago and don't have tasks
  DELETE FROM payment_flow_stages
  WHERE flow_id = v_flow_id
  AND id NOT IN (v_facturacion_stage_id, v_pago_stage_id)
  AND id NOT IN (SELECT stage_id FROM payment_flow_tasks);
END $$;

-- Create or update function to handle Fecha de Pago 2 completion
CREATE OR REPLACE FUNCTION handle_fecha_pago_2_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_broker_commission_id uuid;
  v_reservation_number text;
  v_is_second_payment boolean;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID and is_second_payment flag
    SELECT flow_id, cf.is_second_payment INTO v_flow_id, v_is_second_payment
    FROM commission_flows cf
    WHERE cf.id = NEW.commission_flow_id;
    
    -- Check if this is Fecha de Pago 2 task and it's a second payment flow
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Pago'
      AND t.name = 'Fecha de Pago 2'
    ) AND v_is_second_payment = true THEN
      -- Get broker commission ID and reservation number
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
      
      -- If commission found, update payment_2_date
      IF v_broker_commission_id IS NOT NULL THEN
        -- Update payment_2_date in broker_commissions
        UPDATE broker_commissions
        SET payment_2_date = NEW.completed_at::date
        WHERE id = v_broker_commission_id;
        
        -- Log the update
        RAISE NOTICE 'Updated payment_2_date for reservation % to %', 
          v_reservation_number, 
          NEW.completed_at::date;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for Fecha de Pago 2 completion
DROP TRIGGER IF EXISTS on_fecha_pago_2_completion ON commission_flow_tasks;
CREATE TRIGGER on_fecha_pago_2_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_fecha_pago_2_completion();

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;