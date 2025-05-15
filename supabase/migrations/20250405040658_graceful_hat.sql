-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- First, identify the second payment flow ID and update existing tasks
DO $$
DECLARE
  v_flow_id uuid;
  v_existing_stages_count integer;
  v_stage_id uuid;
  v_facturacion_stage_id uuid;
  v_pago_stage_id uuid;
  v_task_id uuid;
  v_task_exists boolean;
BEGIN
  -- Get the ID of the second payment flow
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Segundo Pago';

  -- Check if there are any existing stages
  SELECT COUNT(*) INTO v_existing_stages_count
  FROM payment_flow_stages
  WHERE flow_id = v_flow_id;

  -- If there are existing stages, update them instead of creating new ones
  IF v_existing_stages_count > 0 THEN
    -- First, get or create the Facturación stage
    SELECT id INTO v_facturacion_stage_id
    FROM payment_flow_stages
    WHERE flow_id = v_flow_id AND "order" = 1;
    
    -- Update the stage name
    UPDATE payment_flow_stages
    SET name = 'Facturación',
        description = 'Proceso de facturación para segundo pago'
    WHERE id = v_facturacion_stage_id;
    
    -- Get or create the Pago stage
    SELECT id INTO v_pago_stage_id
    FROM payment_flow_stages
    WHERE flow_id = v_flow_id AND "order" = 2;
    
    -- Update the stage name
    UPDATE payment_flow_stages
    SET name = 'Pago',
        description = 'Proceso de pago para segundo pago'
    WHERE id = v_pago_stage_id;
    
    -- Update or create tasks for Facturación stage
    -- First, check if tasks exist
    SELECT COUNT(*) > 0 INTO v_task_exists
    FROM payment_flow_tasks
    WHERE stage_id = v_facturacion_stage_id AND "order" = 1;
    
    IF v_task_exists THEN
      -- Update existing task
      UPDATE payment_flow_tasks
      SET name = 'Generación de Entrada 2',
          description = 'Generación de entrada en sistema para segundo pago',
          days_to_complete = 2
      WHERE stage_id = v_facturacion_stage_id AND "order" = 1;
    ELSE
      -- Create new task
      INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
      VALUES (v_facturacion_stage_id, 'Generación de Entrada 2', 'Generación de entrada en sistema para segundo pago', 1, true, 2);
    END IF;
    
    -- Check if task 2 exists
    SELECT COUNT(*) > 0 INTO v_task_exists
    FROM payment_flow_tasks
    WHERE stage_id = v_facturacion_stage_id AND "order" = 2;
    
    IF v_task_exists THEN
      -- Update existing task
      UPDATE payment_flow_tasks
      SET name = 'Aprobación de Entrada 2',
          description = 'Aprobación de la entrada generada para segundo pago',
          days_to_complete = 2
      WHERE stage_id = v_facturacion_stage_id AND "order" = 2;
    ELSE
      -- Create new task
      INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
      VALUES (v_facturacion_stage_id, 'Aprobación de Entrada 2', 'Aprobación de la entrada generada para segundo pago', 2, true, 2);
    END IF;
    
    -- Check if task 3 exists
    SELECT COUNT(*) > 0 INTO v_task_exists
    FROM payment_flow_tasks
    WHERE stage_id = v_facturacion_stage_id AND "order" = 3;
    
    IF v_task_exists THEN
      -- Update existing task
      UPDATE payment_flow_tasks
      SET name = 'Envío Entrada Broker 2',
          description = 'Envío de entrada al Broker para segundo pago',
          days_to_complete = 1
      WHERE stage_id = v_facturacion_stage_id AND "order" = 3;
    ELSE
      -- Create new task
      INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
      VALUES (v_facturacion_stage_id, 'Envío Entrada Broker 2', 'Envío de entrada al Broker para segundo pago', 3, true, 1);
    END IF;
    
    -- Check if task 4 exists
    SELECT COUNT(*) > 0 INTO v_task_exists
    FROM payment_flow_tasks
    WHERE stage_id = v_facturacion_stage_id AND "order" = 4;
    
    IF v_task_exists THEN
      -- Update existing task
      UPDATE payment_flow_tasks
      SET name = 'Recepción Factura 2 Broker',
          description = 'Recepción de factura del Broker para segundo pago',
          days_to_complete = 3
      WHERE stage_id = v_facturacion_stage_id AND "order" = 4;
    ELSE
      -- Create new task
      INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
      VALUES (v_facturacion_stage_id, 'Recepción Factura 2 Broker', 'Recepción de factura del Broker para segundo pago', 4, true, 3);
    END IF;
    
    -- Update or create tasks for Pago stage
    -- First, check if tasks exist
    SELECT COUNT(*) > 0 INTO v_task_exists
    FROM payment_flow_tasks
    WHERE stage_id = v_pago_stage_id AND "order" = 1;
    
    IF v_task_exists THEN
      -- Update existing task
      UPDATE payment_flow_tasks
      SET name = 'Notificación a Finanzas 2',
          description = 'Notificación del pago a Finanzas para segundo pago',
          days_to_complete = 1
      WHERE stage_id = v_pago_stage_id AND "order" = 1;
    ELSE
      -- Create new task
      INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
      VALUES (v_pago_stage_id, 'Notificación a Finanzas 2', 'Notificación del pago a Finanzas para segundo pago', 1, true, 1);
    END IF;
    
    -- Check if task 2 exists
    SELECT COUNT(*) > 0 INTO v_task_exists
    FROM payment_flow_tasks
    WHERE stage_id = v_pago_stage_id AND "order" = 2;
    
    IF v_task_exists THEN
      -- Update existing task
      UPDATE payment_flow_tasks
      SET name = 'Fecha de Pago 2',
          description = 'Registro de fecha de pago efectivo para segundo pago',
          days_to_complete = 2
      WHERE stage_id = v_pago_stage_id AND "order" = 2;
    ELSE
      -- Create new task
      INSERT INTO payment_flow_tasks (stage_id, name, description, "order", is_required, days_to_complete)
      VALUES (v_pago_stage_id, 'Fecha de Pago 2', 'Registro de fecha de pago efectivo para segundo pago', 2, true, 2);
    END IF;
    
    -- Delete any tasks with order > 4 in Facturación stage
    DELETE FROM payment_flow_tasks
    WHERE stage_id = v_facturacion_stage_id AND "order" > 4
    AND id NOT IN (SELECT task_id FROM commission_flow_tasks);
    
    -- Delete any tasks with order > 2 in Pago stage
    DELETE FROM payment_flow_tasks
    WHERE stage_id = v_pago_stage_id AND "order" > 2
    AND id NOT IN (SELECT task_id FROM commission_flow_tasks);
    
    -- Delete any stages with order > 2
    DELETE FROM payment_flow_stages
    WHERE flow_id = v_flow_id AND "order" > 2
    AND id NOT IN (SELECT stage_id FROM payment_flow_tasks WHERE id IN (SELECT task_id FROM commission_flow_tasks));
    
  ELSE
    -- If no existing stages, create new ones
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

-- Modify handle_fecha_pago_completion to allow admin to set payment_1_date
CREATE OR REPLACE FUNCTION handle_fecha_pago_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_broker_commission_id uuid;
  v_reservation_number text;
  v_is_second_payment boolean;
  v_is_admin boolean;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND user_type = 'Administrador'
  ) INTO v_is_admin;

  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID and is_second_payment flag
    SELECT flow_id, cf.is_second_payment INTO v_flow_id, v_is_second_payment
    FROM commission_flows cf
    WHERE cf.id = NEW.commission_flow_id;
    
    -- Check if this is Fecha de Pago task and it's NOT a second payment flow
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Pago'
      AND t.name = 'Fecha de Pago'
    ) AND NOT v_is_second_payment THEN
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
      
      -- If commission found, update payment_1_date
      IF v_broker_commission_id IS NOT NULL THEN
        -- Update payment_1_date in broker_commissions
        UPDATE broker_commissions
        SET payment_1_date = NEW.completed_at::date
        WHERE id = v_broker_commission_id;
        
        -- Log the update
        RAISE NOTICE 'Updated payment_1_date for reservation % to %', 
          v_reservation_number, 
          NEW.completed_at::date;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for Fecha de Pago completion
DROP TRIGGER IF EXISTS on_fecha_pago_completion ON commission_flow_tasks;
CREATE TRIGGER on_fecha_pago_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_fecha_pago_completion();

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;