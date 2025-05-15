/*
  # Fix payment flow date synchronization

  1. Changes
    - Update initialize_commission_flow to set Solicitud Liquidación task start date to flow start date
    - Update flow_start_date_change trigger to properly update task dates
    - Ensure proper date propagation when flow start date changes
    
  2. Security
    - Maintain existing RLS policies
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Create function to handle flow initialization with proper date synchronization
CREATE OR REPLACE FUNCTION initialize_commission_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_first_task_id uuid;
  v_first_task_assignee_id uuid;
  v_solicitud_liquidacion_task_id uuid;
  v_solicitud_liquidacion_flow_task_id uuid;
  v_existing_task_count integer;
BEGIN
  -- First check if tasks already exist for this flow
  SELECT COUNT(*) INTO v_existing_task_count
  FROM commission_flow_tasks
  WHERE commission_flow_id = NEW.id;

  -- If tasks already exist, exit early
  IF v_existing_task_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Get first task of the flow and its default assignee
  SELECT t.id, t.default_assignee_id 
  INTO v_first_task_id, v_first_task_assignee_id
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ORDER BY s."order", t."order"
  LIMIT 1;

  -- Get Solicitud Liquidación task ID
  SELECT t.id INTO v_solicitud_liquidacion_task_id
  FROM payment_flow_tasks t
  JOIN payment_flow_stages s ON s.id = t.stage_id
  WHERE s.flow_id = NEW.flow_id
  AND s.name = 'Solicitud Liquidación'
  AND t.name = 'Solicitud Liquidación';

  -- Insert all tasks with proper status and assignments
  INSERT INTO commission_flow_tasks (
    commission_flow_id,
    task_id,
    status,
    started_at,
    completed_at,
    assigned_at,
    assignee_id
  )
  SELECT 
    NEW.id,
    t.id,
    CASE 
      WHEN NEW.status = 'in_progress' AND t.id = v_first_task_id THEN 'pending'
      ELSE 'blocked'
    END,
    CASE
      -- Set started_at to flow's started_at for Solicitud Liquidación task
      WHEN NEW.status = 'in_progress' AND t.id = v_solicitud_liquidacion_task_id THEN NEW.started_at
      ELSE NULL
    END,
    NULL,
    CASE 
      WHEN NEW.status = 'in_progress' AND t.id = v_first_task_id AND t.default_assignee_id IS NOT NULL 
      THEN now()
      ELSE NULL
    END,
    CASE 
      WHEN NEW.status = 'in_progress' AND t.id = v_first_task_id 
      THEN t.default_assignee_id
      ELSE NULL
    END
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ORDER BY s."order", t."order";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to update task dates when flow start date changes
CREATE OR REPLACE FUNCTION update_task_dates_on_flow_start_change()
RETURNS TRIGGER AS $$
DECLARE
  v_solicitud_liquidacion_task_id uuid;
  v_solicitud_liquidacion_flow_task_id uuid;
  v_solicitud_liquidacion_status text;
BEGIN
  -- Only proceed if the start date has changed
  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    -- Get Solicitud Liquidación task ID
    SELECT t.id INTO v_solicitud_liquidacion_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = NEW.flow_id
    AND s.name = 'Solicitud Liquidación'
    AND t.name = 'Solicitud Liquidación';
    
    -- Get commission_flow_task ID and status for Solicitud Liquidación
    SELECT id, status 
    INTO v_solicitud_liquidacion_flow_task_id, v_solicitud_liquidacion_status
    FROM commission_flow_tasks
    WHERE commission_flow_id = NEW.id
    AND task_id = v_solicitud_liquidacion_task_id;
    
    -- If task exists, update its start date directly
    IF v_solicitud_liquidacion_flow_task_id IS NOT NULL THEN
      -- Update the task
      UPDATE commission_flow_tasks
      SET 
        started_at = NEW.started_at,
        status = CASE 
          WHEN status = 'blocked' AND NEW.status = 'in_progress' THEN 'pending'
          ELSE status
        END
      WHERE id = v_solicitud_liquidacion_flow_task_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for flow start date changes
DROP TRIGGER IF EXISTS on_flow_start_date_change ON commission_flows;
CREATE TRIGGER on_flow_start_date_change
  AFTER UPDATE OF started_at ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_task_dates_on_flow_start_change();

-- Fix existing task dates for in-progress flows
DO $$
DECLARE
  v_flow record;
  v_solicitud_liquidacion_task_id uuid;
  v_solicitud_liquidacion_flow_task_id uuid;
BEGIN
  -- For each commission flow
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id, cf.started_at
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
    AND cf.started_at IS NOT NULL
  LOOP
    -- Get Solicitud Liquidación task
    SELECT pft.id, cft.id 
    INTO v_solicitud_liquidacion_task_id, v_solicitud_liquidacion_flow_task_id
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Solicitud Liquidación'
    AND pft.name = 'Solicitud Liquidación';
    
    -- If task exists, update its start date
    IF v_solicitud_liquidacion_flow_task_id IS NOT NULL THEN
      -- Update the task directly (trigger is disabled)
      UPDATE commission_flow_tasks
      SET started_at = v_flow.started_at
      WHERE id = v_solicitud_liquidacion_flow_task_id;
    END IF;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;