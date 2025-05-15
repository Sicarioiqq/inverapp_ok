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

-- Create trigger for Fecha de Pago completion if it doesn't exist
DROP TRIGGER IF EXISTS on_fecha_pago_completion ON commission_flow_tasks;
CREATE TRIGGER on_fecha_pago_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_fecha_pago_completion();