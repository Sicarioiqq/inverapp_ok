/*
  # Fix payment flow task order and status handling

  1. Changes
    - Update handle_generacion_oc_completion function to properly handle task progression
    - Ensure VB OC Gerencia Comercial is blocked until Generación de OC is completed
    - Ensure VB OC Gerencia General is blocked until VB OC Gerencia Comercial is completed
    - Ensure Envío OC Broker is blocked until VB OC Gerencia General is completed
    - Fix existing task statuses to maintain proper order

  2. Security
    - Maintain existing RLS policies
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Create function to handle Generación de OC completion
CREATE OR REPLACE FUNCTION handle_generacion_oc_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_oc_gerencia_task_id uuid;
  v_vb_oc_gerencia_flow_task_id uuid;
  v_vb_oc_gerencia_general_task_id uuid;
  v_vb_oc_gerencia_general_flow_task_id uuid;
  v_envio_oc_broker_task_id uuid;
  v_envio_oc_broker_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is Generación de OC task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'Generación de OC'
    ) THEN
      -- Get VB OC Gerencia Comercial task ID
      SELECT t.id INTO v_vb_oc_gerencia_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'VB OC Gerencia Comercial';
      
      -- Get VB OC Gerencia General task ID
      SELECT t.id INTO v_vb_oc_gerencia_general_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'VB OC Gerencia General';
      
      -- Get Envío OC Broker task ID
      SELECT t.id INTO v_envio_oc_broker_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'Envío OC Broker';
      
      -- Get commission_flow_task IDs
      SELECT id INTO v_vb_oc_gerencia_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_vb_oc_gerencia_task_id;
      
      SELECT id INTO v_vb_oc_gerencia_general_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_vb_oc_gerencia_general_task_id;
      
      SELECT id INTO v_envio_oc_broker_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_envio_oc_broker_task_id;
      
      -- Update VB OC Gerencia Comercial to pending and set start date
      IF v_vb_oc_gerencia_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = 'pending'
        WHERE id = v_vb_oc_gerencia_flow_task_id;
      END IF;
      
      -- Ensure VB OC Gerencia General remains blocked
      IF v_vb_oc_gerencia_general_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'blocked',
          started_at = NULL
        WHERE id = v_vb_oc_gerencia_general_flow_task_id;
      END IF;
      
      -- Ensure Envío OC Broker remains blocked
      IF v_envio_oc_broker_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'blocked',
          started_at = NULL
        WHERE id = v_envio_oc_broker_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle VB OC Gerencia Comercial completion
CREATE OR REPLACE FUNCTION handle_vb_oc_gerencia_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_oc_gerencia_general_task_id uuid;
  v_vb_oc_gerencia_general_flow_task_id uuid;
  v_envio_oc_broker_task_id uuid;
  v_envio_oc_broker_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is VB OC Gerencia Comercial task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'VB OC Gerencia Comercial'
    ) THEN
      -- Get VB OC Gerencia General task ID
      SELECT t.id INTO v_vb_oc_gerencia_general_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'VB OC Gerencia General';
      
      -- Get Envío OC Broker task ID
      SELECT t.id INTO v_envio_oc_broker_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'Envío OC Broker';
      
      -- Get commission_flow_task IDs
      SELECT id INTO v_vb_oc_gerencia_general_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_vb_oc_gerencia_general_task_id;
      
      SELECT id INTO v_envio_oc_broker_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_envio_oc_broker_task_id;
      
      -- Update VB OC Gerencia General to pending and set start date
      IF v_vb_oc_gerencia_general_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = 'pending'
        WHERE id = v_vb_oc_gerencia_general_flow_task_id;
      END IF;
      
      -- Ensure Envío OC Broker remains blocked
      IF v_envio_oc_broker_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'blocked',
          started_at = NULL
        WHERE id = v_envio_oc_broker_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle VB OC Gerencia General completion
CREATE OR REPLACE FUNCTION handle_vb_gerente_general_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_envio_oc_broker_task_id uuid;
  v_envio_oc_broker_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is VB OC Gerencia General task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'VB OC Gerencia General'
    ) THEN
      -- Get Envío OC Broker task ID
      SELECT t.id INTO v_envio_oc_broker_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'Envío OC Broker';
      
      -- Get commission_flow_task ID
      SELECT id INTO v_envio_oc_broker_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_envio_oc_broker_task_id;
      
      -- Update Envío OC Broker to pending and set start date
      IF v_envio_oc_broker_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = 'pending'
        WHERE id = v_envio_oc_broker_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for task completions
DROP TRIGGER IF EXISTS on_generacion_oc_completion ON commission_flow_tasks;
CREATE TRIGGER on_generacion_oc_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_generacion_oc_completion();

DROP TRIGGER IF EXISTS on_vb_oc_gerencia_completion ON commission_flow_tasks;
CREATE TRIGGER on_vb_oc_gerencia_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_vb_oc_gerencia_completion();

DROP TRIGGER IF EXISTS on_vb_gerente_general_completion ON commission_flow_tasks;
CREATE TRIGGER on_vb_gerente_general_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_vb_gerente_general_completion();

-- Fix existing task statuses for in-progress flows
DO $$
DECLARE
  v_flow record;
  v_generacion_oc_task_id uuid;
  v_generacion_oc_flow_task_id uuid;
  v_generacion_oc_status text;
  v_vb_oc_gerencia_task_id uuid;
  v_vb_oc_gerencia_flow_task_id uuid;
  v_vb_oc_gerencia_status text;
  v_vb_oc_gerencia_general_task_id uuid;
  v_vb_oc_gerencia_general_flow_task_id uuid;
  v_vb_oc_gerencia_general_status text;
  v_envio_oc_broker_task_id uuid;
  v_envio_oc_broker_flow_task_id uuid;
BEGIN
  -- For each commission flow
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Get task IDs
    SELECT t.id INTO v_generacion_oc_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Orden de Compra'
    AND t.name = 'Generación de OC';
    
    SELECT t.id INTO v_vb_oc_gerencia_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Orden de Compra'
    AND t.name = 'VB OC Gerencia Comercial';
    
    SELECT t.id INTO v_vb_oc_gerencia_general_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Orden de Compra'
    AND t.name = 'VB OC Gerencia General';
    
    SELECT t.id INTO v_envio_oc_broker_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Orden de Compra'
    AND t.name = 'Envío OC Broker';
    
    -- Get commission_flow_task IDs and statuses
    SELECT id, status INTO v_generacion_oc_flow_task_id, v_generacion_oc_status
    FROM commission_flow_tasks
    WHERE commission_flow_id = v_flow.id
    AND task_id = v_generacion_oc_task_id;
    
    SELECT id, status INTO v_vb_oc_gerencia_flow_task_id, v_vb_oc_gerencia_status
    FROM commission_flow_tasks
    WHERE commission_flow_id = v_flow.id
    AND task_id = v_vb_oc_gerencia_task_id;
    
    SELECT id, status INTO v_vb_oc_gerencia_general_flow_task_id, v_vb_oc_gerencia_general_status
    FROM commission_flow_tasks
    WHERE commission_flow_id = v_flow.id
    AND task_id = v_vb_oc_gerencia_general_task_id;
    
    SELECT id INTO v_envio_oc_broker_flow_task_id
    FROM commission_flow_tasks
    WHERE commission_flow_id = v_flow.id
    AND task_id = v_envio_oc_broker_task_id;
    
    -- Fix task statuses based on dependencies
    
    -- If Generación de OC is not completed, block subsequent tasks
    IF v_generacion_oc_status != 'completed' THEN
      -- Block VB OC Gerencia Comercial
      IF v_vb_oc_gerencia_flow_task_id IS NOT NULL AND v_vb_oc_gerencia_status != 'completed' THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'blocked',
          started_at = NULL
        WHERE id = v_vb_oc_gerencia_flow_task_id;
      END IF;
      
      -- Block VB OC Gerencia General
      IF v_vb_oc_gerencia_general_flow_task_id IS NOT NULL AND v_vb_oc_gerencia_general_status != 'completed' THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'blocked',
          started_at = NULL
        WHERE id = v_vb_oc_gerencia_general_flow_task_id;
      END IF;
      
      -- Block Envío OC Broker
      IF v_envio_oc_broker_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'blocked',
          started_at = NULL
        WHERE id = v_envio_oc_broker_flow_task_id;
      END IF;
    -- If Generación de OC is completed but VB OC Gerencia Comercial is not
    ELSIF v_vb_oc_gerencia_status != 'completed' THEN
      -- Block VB OC Gerencia General
      IF v_vb_oc_gerencia_general_flow_task_id IS NOT NULL AND v_vb_oc_gerencia_general_status != 'completed' THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'blocked',
          started_at = NULL
        WHERE id = v_vb_oc_gerencia_general_flow_task_id;
      END IF;
      
      -- Block Envío OC Broker
      IF v_envio_oc_broker_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'blocked',
          started_at = NULL
        WHERE id = v_envio_oc_broker_flow_task_id;
      END IF;
    -- If VB OC Gerencia Comercial is completed but VB OC Gerencia General is not
    ELSIF v_vb_oc_gerencia_general_status != 'completed' THEN
      -- Block Envío OC Broker
      IF v_envio_oc_broker_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'blocked',
          started_at = NULL
        WHERE id = v_envio_oc_broker_flow_task_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;