/*
  # Fix default assignee for approval tasks

  1. Changes
    - Update handle_vb_jefe_completion function to properly assign default user
    - Ensure Solicitud Gerente Comercial gets the default assignee when VB Jefe Inversiones is completed
    - Fix task status and assignment handling
    - Ensure this is the only function handling VB Jefe Inversiones completion
    
  2. Notes
    - Maintains existing task relationships
    - Preserves task order and dependencies
    - Other triggers remain active for their specific cases
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Create a function to handle VB Jefe Inversiones completion
CREATE OR REPLACE FUNCTION handle_vb_jefe_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_solicitud_operaciones_task_id uuid;
  v_solicitud_operaciones_flow_task_id uuid;
  v_solicitud_operaciones_default_assignee_id uuid;
  v_solicitud_gerente_task_id uuid;
  v_solicitud_gerente_flow_task_id uuid;
  v_solicitud_gerente_default_assignee_id uuid;
  v_is_vb_jefe boolean;
BEGIN
  -- Check if this is VB Jefe Inversiones task
  SELECT EXISTS (
    SELECT 1
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE t.id = NEW.task_id
    AND s.name = 'Aprobación Jefe Inversiones'
    AND t.name = 'VB Jefe Inversiones'
  ) INTO v_is_vb_jefe;

  -- Only proceed if this is VB Jefe Inversiones task and it's being completed
  IF v_is_vb_jefe AND 
     ((NEW.status = 'completed' AND OLD.status != 'completed') OR 
      (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at)) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Get Solicitud Operaciones task ID and default assignee
    SELECT t.id, t.default_assignee_id 
    INTO v_solicitud_operaciones_task_id, v_solicitud_operaciones_default_assignee_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow_id
    AND s.name = 'Aprobación Operaciones'
    AND t.name = 'Solicitud Operaciones';
    
    -- Get commission_flow_task ID for Solicitud Operaciones
    SELECT id INTO v_solicitud_operaciones_flow_task_id
    FROM commission_flow_tasks
    WHERE commission_flow_id = NEW.commission_flow_id
    AND task_id = v_solicitud_operaciones_task_id;
    
    -- Get Solicitud Gerente Comercial task ID and default assignee
    SELECT t.id, t.default_assignee_id 
    INTO v_solicitud_gerente_task_id, v_solicitud_gerente_default_assignee_id
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
    
    -- Update Solicitud Operaciones if it exists
    IF v_solicitud_operaciones_flow_task_id IS NOT NULL THEN
      UPDATE commission_flow_tasks
      SET 
        started_at = NEW.completed_at,
        status = 'pending',
        assignee_id = v_solicitud_operaciones_default_assignee_id,
        assigned_at = CASE 
          WHEN v_solicitud_operaciones_default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END
      WHERE id = v_solicitud_operaciones_flow_task_id;
    END IF;
    
    -- Update Solicitud Gerente Comercial if it exists
    IF v_solicitud_gerente_flow_task_id IS NOT NULL THEN
      UPDATE commission_flow_tasks
      SET 
        started_at = NEW.completed_at,
        status = 'pending',
        assignee_id = v_solicitud_gerente_default_assignee_id,
        assigned_at = CASE 
          WHEN v_solicitud_gerente_default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END
      WHERE id = v_solicitud_gerente_flow_task_id;
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

-- Fix existing task dates and assignees for in-progress flows
DO $$
DECLARE
  v_flow record;
  v_vb_jefe_task_id uuid;
  v_vb_jefe_flow_task_id uuid;
  v_vb_jefe_completed_at timestamptz;
  v_vb_jefe_status text;
  v_solicitud_gerente_task_id uuid;
  v_solicitud_gerente_flow_task_id uuid;
  v_default_assignee_id uuid;
BEGIN
  -- For each commission flow
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Get VB Jefe Inversiones task
    SELECT pft.id, cft.id, cft.completed_at, cft.status
    INTO v_vb_jefe_task_id, v_vb_jefe_flow_task_id, v_vb_jefe_completed_at, v_vb_jefe_status
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Aprobación Jefe Inversiones'
    AND pft.name = 'VB Jefe Inversiones';
    
    -- Get Solicitud Gerente Comercial task and default assignee
    SELECT pft.id, cft.id, pft.default_assignee_id
    INTO v_solicitud_gerente_task_id, v_solicitud_gerente_flow_task_id, v_default_assignee_id
    FROM payment_flow_tasks pft
    JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
    LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
    WHERE pfs.flow_id = v_flow.flow_id
    AND pfs.name = 'Aprobación Gerente Comercial'
    AND pft.name = 'Solicitud Gerente Comercial';
    
    -- If VB Jefe Inversiones is completed, update Solicitud Gerente Comercial
    IF v_vb_jefe_status = 'completed' AND v_vb_jefe_completed_at IS NOT NULL AND v_solicitud_gerente_flow_task_id IS NOT NULL THEN
      -- Update the task directly (trigger is disabled)
      UPDATE commission_flow_tasks
      SET 
        started_at = v_vb_jefe_completed_at,
        status = 'pending',
        assignee_id = v_default_assignee_id,
        assigned_at = CASE 
          WHEN v_default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END
      WHERE id = v_solicitud_gerente_flow_task_id;
    -- If VB Jefe Inversiones is not completed, ensure Solicitud Gerente Comercial is blocked
    ELSIF v_vb_jefe_status != 'completed' AND v_solicitud_gerente_flow_task_id IS NOT NULL THEN
      -- Update the task directly (trigger is disabled)
      UPDATE commission_flow_tasks
      SET 
        status = 'blocked',
        started_at = NULL,
        assignee_id = NULL,
        assigned_at = NULL
      WHERE id = v_solicitud_gerente_flow_task_id;
    END IF;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;