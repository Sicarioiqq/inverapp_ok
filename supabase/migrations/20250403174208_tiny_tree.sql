/*
  # Add automatic task date propagation for payment flow

  1. Changes
    - Update handle_vb_jefe_completion to set Solicitud Gerente Comercial start date
    - Add trigger to update next task start date when a task is completed
    - Fix existing task dates for in-progress flows
    - Ensure proper date propagation throughout the payment flow
    
  2. Notes
    - Maintains existing task relationships and dependencies
    - Preserves existing task status handling
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Create a function to handle VB Jefe Inversiones completion
CREATE OR REPLACE FUNCTION handle_vb_jefe_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_solicitud_gerente_task_id uuid;
  v_solicitud_gerente_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is VB Jefe Inversiones task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Aprobación Jefe Inversiones'
      AND t.name = 'VB Jefe Inversiones'
    ) THEN
      -- Get Solicitud Gerente Comercial task ID
      SELECT t.id INTO v_solicitud_gerente_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Aprobación Gerente Comercial'
      AND t.name = 'Solicitud Gerente Comercial';
      
      -- Get commission_flow_task ID for Solicitud Gerente Comercial
      SELECT id INTO v_solicitud_gerente_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_solicitud_gerente_task_id;
      
      -- If task exists, update its start date
      IF v_solicitud_gerente_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_solicitud_gerente_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for VB Jefe Inversiones completion
DROP TRIGGER IF EXISTS on_vb_jefe_completion ON commission_flow_tasks;
CREATE TRIGGER on_vb_jefe_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_vb_jefe_completion();

-- Function to update next task start date when a task is completed
CREATE OR REPLACE FUNCTION update_next_task_start_date()
RETURNS trigger AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task record;
BEGIN
  -- Only proceed if the completion date has changed and the task is completed
  IF NEW.completed_at IS DISTINCT FROM OLD.completed_at AND NEW.status = 'completed' THEN
    -- Get current task position and flow ID
    SELECT 
      f.flow_id,
      s."order",
      t."order"
    INTO 
      v_flow_id,
      v_current_stage_order,
      v_current_task_order
    FROM commission_flows f
    JOIN payment_flow_stages s ON s.id = f.current_stage_id
    JOIN payment_flow_tasks t ON t.id = NEW.task_id
    WHERE f.id = NEW.commission_flow_id;

    -- Get next task in the same stage
    SELECT 
      cft.id as task_id,
      t.id as original_task_id,
      s.id as stage_id,
      s."order" as stage_order,
      t."order" as task_order
    INTO v_next_task
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    JOIN commission_flow_tasks cft ON cft.task_id = t.id AND cft.commission_flow_id = NEW.commission_flow_id
    WHERE s.flow_id = v_flow_id
    AND (
      (s."order" = v_current_stage_order AND t."order" > v_current_task_order) OR
      (s."order" > v_current_stage_order AND t."order" = 1)
    )
    ORDER BY s."order", t."order"
    LIMIT 1;

    -- If there is a next task, update its start date
    IF v_next_task IS NOT NULL THEN
      UPDATE commission_flow_tasks
      SET started_at = NEW.completed_at
      WHERE id = v_next_task.task_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating the next task's start date
DROP TRIGGER IF EXISTS on_task_completion_date_change ON commission_flow_tasks;
CREATE TRIGGER on_task_completion_date_change
  AFTER UPDATE OF completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_next_task_start_date();

-- Fix existing task dates for in-progress flows
DO $$
DECLARE
  v_flow record;
  v_vb_jefe_task_id uuid;
  v_vb_jefe_flow_task_id uuid;
  v_vb_jefe_completed_at timestamptz;
  v_solicitud_gerente_task_id uuid;
  v_solicitud_gerente_flow_task_id uuid;
BEGIN
  -- For each commission flow
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Get VB Jefe Inversiones task
    SELECT pft.id, cft.id, cft.completed_at 
    INTO v_vb_jefe_task_id, v_vb_jefe_flow_task_id, v_vb_jefe_completed_at
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Aprobación Jefe Inversiones'
    AND pft.name = 'VB Jefe Inversiones'
    AND cft.status = 'completed';
    
    -- If found completed task
    IF v_vb_jefe_task_id IS NOT NULL AND v_vb_jefe_completed_at IS NOT NULL THEN
      -- Get Solicitud Gerente Comercial task
      SELECT pft.id, cft.id 
      INTO v_solicitud_gerente_task_id, v_solicitud_gerente_flow_task_id
      FROM payment_flow_tasks pft
      JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
      LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
      WHERE pfs.flow_id = v_flow.flow_id
      AND pfs.name = 'Aprobación Gerente Comercial'
      AND pft.name = 'Solicitud Gerente Comercial';
      
      -- If task exists, update its start date
      IF v_solicitud_gerente_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET started_at = v_vb_jefe_completed_at
        WHERE id = v_solicitud_gerente_flow_task_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;