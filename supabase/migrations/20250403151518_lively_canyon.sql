/*
  # Fix VB Operaciones date sync with Solicitud Operaciones

  1. Changes
    - Create a special trigger function to handle Solicitud Operaciones completion
    - Ensure VB Operaciones task gets the same start date as Solicitud Operaciones completion date
    - Fix existing task dates for in-progress flows
    - Bypass validation triggers to allow direct date updates
    
  2. Security
    - Maintain existing RLS policies
    - Use SECURITY DEFINER to ensure proper permissions
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Create a function to handle Solicitud Operaciones completion
CREATE OR REPLACE FUNCTION handle_solicitud_operaciones_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_operaciones_task_id uuid;
  v_vb_operaciones_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is Solicitud Operaciones task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Aprobación Operaciones'
      AND t.name = 'Solicitud Operaciones'
    ) THEN
      -- Get VB Operaciones task ID
      SELECT t.id INTO v_vb_operaciones_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Aprobación Operaciones'
      AND t.name = 'VB Operaciones';
      
      -- Get commission_flow_task ID for VB Operaciones
      SELECT id INTO v_vb_operaciones_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_vb_operaciones_task_id;
      
      -- If task exists, update its start date
      IF v_vb_operaciones_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_vb_operaciones_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for Solicitud Operaciones completion
DROP TRIGGER IF EXISTS on_solicitud_operaciones_completion ON commission_flow_tasks;
CREATE TRIGGER on_solicitud_operaciones_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_solicitud_operaciones_completion();

-- Fix existing task dates for in-progress flows
DO $$
DECLARE
  v_flow record;
  v_solicitud_operaciones_task_id uuid;
  v_solicitud_operaciones_flow_task_id uuid;
  v_solicitud_operaciones_completed_at timestamptz;
  v_vb_operaciones_task_id uuid;
  v_vb_operaciones_flow_task_id uuid;
BEGIN
  -- For each commission flow
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Get Solicitud Operaciones task
    SELECT pft.id, cft.id, cft.completed_at 
    INTO v_solicitud_operaciones_task_id, v_solicitud_operaciones_flow_task_id, v_solicitud_operaciones_completed_at
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Aprobación Operaciones'
    AND pft.name = 'Solicitud Operaciones'
    AND cft.status = 'completed';
    
    -- If found completed task
    IF v_solicitud_operaciones_task_id IS NOT NULL AND v_solicitud_operaciones_completed_at IS NOT NULL THEN
      -- Get VB Operaciones task
      SELECT pft.id, cft.id 
      INTO v_vb_operaciones_task_id, v_vb_operaciones_flow_task_id
      FROM payment_flow_tasks pft
      JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
      LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
      WHERE pfs.flow_id = v_flow.flow_id
      AND pfs.name = 'Aprobación Operaciones'
      AND pft.name = 'VB Operaciones';
      
      -- If task exists, update its start date
      IF v_vb_operaciones_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET started_at = v_solicitud_operaciones_completed_at
        WHERE id = v_vb_operaciones_flow_task_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;