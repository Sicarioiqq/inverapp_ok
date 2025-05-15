/*
  # Add PENDIENTE ORIGEN DE FONDOS task and fix task progression

  1. New Tasks
    - Add "PENDIENTE ORIGEN DE FONDOS" task to Promesa stage
    - Position it between "PENDIENTE GENERACIÓN PROMESA" and "PENDIENTE VB PROMESA"
    
  2. Changes
    - Create function to handle VB Jefe Inversiones completion
    - Fix task progression between stages
    - Update existing task dates for in-progress flows
    
  3. Security
    - Temporarily disable validation trigger during updates
    - Re-enable trigger after updates are complete
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Add PENDIENTE ORIGEN DE FONDOS task if it doesn't exist
DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
  v_task_exists boolean;
BEGIN
  -- Get the flow ID
  SELECT id INTO v_flow_id 
  FROM sale_flows 
  WHERE name = 'Flujo de Venta Regular';

  -- Get the Promesa stage ID
  SELECT id INTO v_stage_id 
  FROM sale_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Promesa';
  
  -- Check if the task already exists
  SELECT EXISTS (
    SELECT 1 FROM sale_flow_tasks
    WHERE stage_id = v_stage_id
    AND name = 'PENDIENTE ORIGEN DE FONDOS'
  ) INTO v_task_exists;
  
  -- Only proceed if the task doesn't already exist
  IF NOT v_task_exists THEN
    -- First, shift all tasks with order >= 2 to make room for the new task
    UPDATE sale_flow_tasks
    SET "order" = "order" + 1
    WHERE stage_id = v_stage_id
    AND "order" >= 2;
    
    -- Now insert the new task at position 2
    INSERT INTO sale_flow_tasks (
      stage_id, 
      name, 
      description, 
      "order", 
      is_required
    ) VALUES (
      v_stage_id,
      'PENDIENTE ORIGEN DE FONDOS',
      'Verificación del origen de fondos del cliente',
      2,
      true
    );
  END IF;
END $$;

-- Create a function to handle VB Jefe Inversiones completion
CREATE OR REPLACE FUNCTION handle_vb_jefe_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_solicitud_operaciones_task_id uuid;
  v_solicitud_operaciones_flow_task_id uuid;
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
      -- Get Solicitud Operaciones task ID
      SELECT t.id INTO v_solicitud_operaciones_task_id
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
      
      -- If task exists, update its start date
      IF v_solicitud_operaciones_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_solicitud_operaciones_flow_task_id;
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

-- Fix existing task dates for in-progress flows
DO $$
DECLARE
  v_flow record;
  v_vb_jefe_task_id uuid;
  v_vb_jefe_flow_task_id uuid;
  v_vb_jefe_completed_at timestamptz;
  v_solicitud_operaciones_task_id uuid;
  v_solicitud_operaciones_flow_task_id uuid;
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
      -- Get Solicitud Operaciones task
      SELECT pft.id, cft.id 
      INTO v_solicitud_operaciones_task_id, v_solicitud_operaciones_flow_task_id
      FROM payment_flow_tasks pft
      JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
      LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
      WHERE pfs.flow_id = v_flow.flow_id
      AND pfs.name = 'Aprobación Operaciones'
      AND pft.name = 'Solicitud Operaciones';
      
      -- If task exists, update its start date
      IF v_solicitud_operaciones_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET started_at = v_vb_jefe_completed_at
        WHERE id = v_solicitud_operaciones_flow_task_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;