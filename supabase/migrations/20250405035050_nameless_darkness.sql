-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- First, identify the second payment flow ID and update existing tasks
DO $$
DECLARE
  v_flow_id uuid;
  v_existing_tasks_count integer;
  v_stage_id uuid;
  v_stage_record RECORD;
  v_task_record RECORD;
BEGIN
  -- Get the ID of the second payment flow
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Segundo Pago';

  -- Check if there are any commission_flow_tasks referencing the payment_flow_tasks
  SELECT COUNT(*) INTO v_existing_tasks_count
  FROM commission_flow_tasks cft
  JOIN payment_flow_tasks pft ON pft.id = cft.task_id
  JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
  WHERE pfs.flow_id = v_flow_id;

  -- If there are existing references, we need to handle them differently
  IF v_existing_tasks_count > 0 THEN
    -- Update the existing tasks instead of deleting them
    -- First, get all the stages
    FOR v_stage_record IN 
      SELECT id, name, "order" 
      FROM payment_flow_stages 
      WHERE flow_id = v_flow_id
      ORDER BY "order"
    LOOP
      -- Update stage names to match the new structure
      IF v_stage_record."order" = 1 THEN
        UPDATE payment_flow_stages SET name = 'Facturación' WHERE id = v_stage_record.id;
      ELSIF v_stage_record."order" = 2 THEN
        UPDATE payment_flow_stages SET name = 'Pago' WHERE id = v_stage_record.id;
      END IF;
      
      -- Update tasks within each stage
      FOR v_task_record IN
        SELECT id, name, "order"
        FROM payment_flow_tasks
        WHERE stage_id = v_stage_record.id
        ORDER BY "order"
      LOOP
        -- Update task names based on stage and order
        IF v_stage_record."order" = 1 THEN -- Facturación stage
          IF v_task_record."order" = 1 THEN
            UPDATE payment_flow_tasks 
            SET name = 'Generación de Entrada 2', 
                description = 'Generación de entrada en sistema para segundo pago',
                days_to_complete = 2
            WHERE id = v_task_record.id;
          ELSIF v_task_record."order" = 2 THEN
            UPDATE payment_flow_tasks 
            SET name = 'Aprobación de Entrada 2', 
                description = 'Aprobación de la entrada generada para segundo pago',
                days_to_complete = 2
            WHERE id = v_task_record.id;
          ELSIF v_task_record."order" = 3 THEN
            UPDATE payment_flow_tasks 
            SET name = 'Envío Entrada Broker 2', 
                description = 'Envío de entrada al Broker para segundo pago',
                days_to_complete = 1
            WHERE id = v_task_record.id;
          ELSIF v_task_record."order" = 4 THEN
            UPDATE payment_flow_tasks 
            SET name = 'Recepción Factura 2 Broker', 
                description = 'Recepción de factura del Broker para segundo pago',
                days_to_complete = 3
            WHERE id = v_task_record.id;
          END IF;
        ELSIF v_stage_record."order" = 2 THEN -- Pago stage
          IF v_task_record."order" = 1 THEN
            UPDATE payment_flow_tasks 
            SET name = 'Notificación a Finanzas 2', 
                description = 'Notificación del pago a Finanzas para segundo pago',
                days_to_complete = 1
            WHERE id = v_task_record.id;
          ELSIF v_task_record."order" = 2 THEN
            UPDATE payment_flow_tasks 
            SET name = 'Fecha de Pago 2', 
                description = 'Registro de fecha de pago efectivo para segundo pago',
                days_to_complete = 2
            WHERE id = v_task_record.id;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  ELSE
    -- If no existing references, we can safely delete and recreate
    -- Delete existing tasks
    DELETE FROM payment_flow_tasks
    WHERE stage_id IN (
      SELECT id FROM payment_flow_stages
      WHERE flow_id = v_flow_id
    );
    
    -- Delete existing stages
    DELETE FROM payment_flow_stages
    WHERE flow_id = v_flow_id;
    
    -- Create Facturación stage
    INSERT INTO payment_flow_stages (flow_id, name, description, "order", is_active)
    VALUES (v_flow_id, 'Facturación', 'Proceso de facturación para segundo pago', 1, true)
    RETURNING id INTO v_stage_id;
    
    -- Create tasks for Facturación stage
    INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
    VALUES 
      (v_stage_id, 'Generación de Entrada 2', 'Generación de entrada en sistema para segundo pago', 1, true, 2),
      (v_stage_id, 'Aprobación de Entrada 2', 'Aprobación de la entrada generada para segundo pago', 2, true, 2),
      (v_stage_id, 'Envío Entrada Broker 2', 'Envío de entrada al Broker para segundo pago', 3, true, 1),
      (v_stage_id, 'Recepción Factura 2 Broker', 'Recepción de factura del Broker para segundo pago', 4, true, 3);

    -- Create Pago stage
    INSERT INTO payment_flow_stages (flow_id, name, description, "order", is_active)
    VALUES (v_flow_id, 'Pago', 'Proceso de pago para segundo pago', 2, true)
    RETURNING id INTO v_stage_id;
    
    -- Create tasks for Pago stage
    INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
    VALUES 
      (v_stage_id, 'Notificación a Finanzas 2', 'Notificación del pago a Finanzas para segundo pago', 1, true, 1),
      (v_stage_id, 'Fecha de Pago 2', 'Registro de fecha de pago efectivo para segundo pago', 2, true, 2);
  END IF;
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