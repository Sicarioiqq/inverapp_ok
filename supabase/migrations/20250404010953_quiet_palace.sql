-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Create a function to handle Solicitud a Jefe Inversiones completion
CREATE OR REPLACE FUNCTION handle_solicitud_jefe_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_jefe_task_id uuid;
  v_vb_jefe_flow_task_id uuid;
  v_default_assignee_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is Solicitud a Jefe Inversiones task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Aprobación Jefe Inversiones'
      AND t.name = 'Solicitud a Jefe Inversiones'
    ) THEN
      -- Get VB Jefe Inversiones task ID and default assignee
      SELECT t.id, t.default_assignee_id 
      INTO v_vb_jefe_task_id, v_default_assignee_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Aprobación Jefe Inversiones'
      AND t.name = 'VB Jefe Inversiones';
      
      -- Get commission_flow_task ID for VB Jefe Inversiones
      SELECT id INTO v_vb_jefe_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_vb_jefe_task_id;
      
      -- If task exists, update its start date, status, and assignee
      IF v_vb_jefe_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = 'pending',
          assignee_id = v_default_assignee_id,
          assigned_at = CASE 
            WHEN v_default_assignee_id IS NOT NULL THEN now()
            ELSE NULL
          END
        WHERE id = v_vb_jefe_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for Solicitud a Jefe Inversiones completion
DROP TRIGGER IF EXISTS on_solicitud_jefe_completion ON commission_flow_tasks;
CREATE TRIGGER on_solicitud_jefe_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_solicitud_jefe_completion();

-- Fix existing task statuses for in-progress flows
DO $$
DECLARE
  v_flow record;
  v_solicitud_jefe_task_id uuid;
  v_solicitud_jefe_flow_task_id uuid;
  v_solicitud_jefe_status text;
  v_vb_jefe_task_id uuid;
  v_vb_jefe_flow_task_id uuid;
  v_default_assignee_id uuid;
BEGIN
  -- For each commission flow
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Get Solicitud a Jefe Inversiones task
    SELECT pft.id, cft.id, cft.status
    INTO v_solicitud_jefe_task_id, v_solicitud_jefe_flow_task_id, v_solicitud_jefe_status
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Aprobación Jefe Inversiones'
    AND pft.name = 'Solicitud a Jefe Inversiones';
    
    -- Get VB Jefe Inversiones task and default assignee
    SELECT pft.id, cft.id, pft.default_assignee_id
    INTO v_vb_jefe_task_id, v_vb_jefe_flow_task_id, v_default_assignee_id
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Aprobación Jefe Inversiones'
    AND pft.name = 'VB Jefe Inversiones';
    
    -- If Solicitud a Jefe Inversiones is not completed, ensure VB Jefe Inversiones is blocked
    IF v_solicitud_jefe_status != 'completed' AND v_vb_jefe_flow_task_id IS NOT NULL THEN
      -- Update the task directly (trigger is disabled)
      UPDATE commission_flow_tasks
      SET 
        status = 'blocked',
        started_at = NULL,
        assignee_id = NULL,
        assigned_at = NULL
      WHERE id = v_vb_jefe_flow_task_id;
    END IF;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;