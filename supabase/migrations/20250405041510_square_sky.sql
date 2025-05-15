-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Update the second payment flow structure
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
BEGIN
  -- Get the ID of the second payment flow
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Segundo Pago';

  -- Get the Facturación stage ID
  SELECT id INTO v_facturacion_stage_id
  FROM payment_flow_stages
  WHERE flow_id = v_flow_id AND "order" = 1;
  
  -- Get the Pago stage ID
  SELECT id INTO v_pago_stage_id
  FROM payment_flow_stages
  WHERE flow_id = v_flow_id AND "order" = 2;
  
  -- First, check if "Aprobación de Entrada 2" exists in the Pago stage
  SELECT id INTO v_task_id
  FROM payment_flow_tasks
  WHERE stage_id = v_pago_stage_id
  AND name = 'Aprobación de Entrada 2';
  
  -- If the task exists in Pago stage, we need to handle it
  IF v_task_id IS NOT NULL THEN
    -- Check if any commission_flow_tasks reference this task
    SELECT EXISTS (
      SELECT 1 FROM commission_flow_tasks
      WHERE task_id = v_task_id
    ) INTO v_task_exists;
    
    IF v_task_exists THEN
      -- Instead of trying to move the task or update references, just leave it as is
      -- but make sure it's not in the UI by updating its name to indicate it's deprecated
      UPDATE payment_flow_tasks
      SET name = '[DEPRECATED] Aprobación de Entrada 2',
          description = 'Esta tarea ha sido reemplazada por una en la etapa de Facturación'
      WHERE id = v_task_id;
    ELSE
      -- If no references, delete the task
      DELETE FROM payment_flow_tasks
      WHERE id = v_task_id;
    END IF;
  END IF;
  
  -- Check if "Aprobación de Entrada 2" exists in the Facturación stage
  SELECT id INTO v_task_id
  FROM payment_flow_tasks
  WHERE stage_id = v_facturacion_stage_id
  AND name = 'Aprobación de Entrada 2';
  
  -- If the task doesn't exist in Facturación stage, create it
  IF v_task_id IS NULL THEN
    -- Find the highest order in the Facturación stage
    SELECT COALESCE(MAX("order"), 0) INTO v_task_count
    FROM payment_flow_tasks
    WHERE stage_id = v_facturacion_stage_id;
    
    -- Create the task with the next order
    INSERT INTO payment_flow_tasks (
      stage_id, 
      name, 
      description, 
      "order", 
      is_required, 
      days_to_complete
    ) VALUES (
      v_facturacion_stage_id,
      'Aprobación de Entrada 2',
      'Aprobación de la entrada generada para segundo pago',
      v_task_count + 1,
      true,
      2
    );
  END IF;
  
  -- Ensure the tasks in the Pago stage are correctly ordered
  UPDATE payment_flow_tasks
  SET "order" = 1
  WHERE stage_id = v_pago_stage_id
  AND name = 'Notificación a Finanzas 2';
  
  UPDATE payment_flow_tasks
  SET "order" = 2
  WHERE stage_id = v_pago_stage_id
  AND name = 'Fecha de Pago 2';
  
  -- Delete any tasks with order > 2 in Pago stage that aren't referenced
  DELETE FROM payment_flow_tasks
  WHERE stage_id = v_pago_stage_id 
  AND "order" > 2
  AND name != '[DEPRECATED] Aprobación de Entrada 2'
  AND id NOT IN (SELECT task_id FROM commission_flow_tasks);
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