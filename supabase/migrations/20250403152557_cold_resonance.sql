/*
  # Add date synchronization between all payment flow tasks

  1. New Functionality
    - Create a comprehensive system to synchronize dates between related tasks
    - Ensure that when a task is completed, the next task's start date is set to the completion date
    - Add specific handlers for key task transitions in the payment flow
    
  2. Changes
    - Add trigger functions for all critical task transitions
    - Implement a general mechanism for date propagation throughout the flow
    - Fix any existing task dates to maintain consistency
    
  3. Security
    - No changes to RLS policies required
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Create a function to handle VB Gerente Comercial completion
CREATE OR REPLACE FUNCTION handle_vb_gerente_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_solicitud_control_gestion_task_id uuid;
  v_solicitud_control_gestion_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is VB Gerente Comercial task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Aprobación Gerente Comercial'
      AND t.name = 'VB Gerente Comercial'
    ) THEN
      -- Get Solicitud Control de Gestión task ID
      SELECT t.id INTO v_solicitud_control_gestion_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Aprobación Control de Gestión'
      AND t.name = 'Solicitud Control de Gestión';
      
      -- Get commission_flow_task ID for Solicitud Control de Gestión
      SELECT id INTO v_solicitud_control_gestion_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_solicitud_control_gestion_task_id;
      
      -- If task exists, update its start date
      IF v_solicitud_control_gestion_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_solicitud_control_gestion_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for VB Gerente Comercial completion
DROP TRIGGER IF EXISTS on_vb_gerente_completion ON commission_flow_tasks;
CREATE TRIGGER on_vb_gerente_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_vb_gerente_completion();

-- Create a function to handle VB Control de Gestión completion
CREATE OR REPLACE FUNCTION handle_vb_control_gestion_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_generacion_oc_task_id uuid;
  v_generacion_oc_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is VB Control de Gestión task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Aprobación Control de Gestión'
      AND t.name = 'VB Control de Gestión'
    ) THEN
      -- Get Generación de OC task ID
      SELECT t.id INTO v_generacion_oc_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Orden de Compra'
      AND t.name = 'Generación de OC';
      
      -- Get commission_flow_task ID for Generación de OC
      SELECT id INTO v_generacion_oc_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_generacion_oc_task_id;
      
      -- If task exists, update its start date
      IF v_generacion_oc_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_generacion_oc_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for VB Control de Gestión completion
DROP TRIGGER IF EXISTS on_vb_control_gestion_completion ON commission_flow_tasks;
CREATE TRIGGER on_vb_control_gestion_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_vb_control_gestion_completion();

-- Create a function to handle Solicitud a Jefe Inversiones completion
CREATE OR REPLACE FUNCTION handle_solicitud_jefe_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_jefe_task_id uuid;
  v_vb_jefe_flow_task_id uuid;
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
      -- Get VB Jefe Inversiones task ID
      SELECT t.id INTO v_vb_jefe_task_id
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
      
      -- If task exists, update its start date
      IF v_vb_jefe_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
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

-- Create a function to handle Solicitud Gerente Comercial completion
CREATE OR REPLACE FUNCTION handle_solicitud_gerente_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_gerente_task_id uuid;
  v_vb_gerente_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is Solicitud Gerente Comercial task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Aprobación Gerente Comercial'
      AND t.name = 'Solicitud Gerente Comercial'
    ) THEN
      -- Get VB Gerente Comercial task ID
      SELECT t.id INTO v_vb_gerente_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Aprobación Gerente Comercial'
      AND t.name = 'VB Gerente Comercial';
      
      -- Get commission_flow_task ID for VB Gerente Comercial
      SELECT id INTO v_vb_gerente_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_vb_gerente_task_id;
      
      -- If task exists, update its start date
      IF v_vb_gerente_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_vb_gerente_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for Solicitud Gerente Comercial completion
DROP TRIGGER IF EXISTS on_solicitud_gerente_completion ON commission_flow_tasks;
CREATE TRIGGER on_solicitud_gerente_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_solicitud_gerente_completion();

-- Create a function to handle Solicitud Control de Gestión completion
CREATE OR REPLACE FUNCTION handle_solicitud_control_gestion_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_control_gestion_task_id uuid;
  v_vb_control_gestion_flow_task_id uuid;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get flow ID
    SELECT flow_id INTO v_flow_id
    FROM commission_flows
    WHERE id = NEW.commission_flow_id;
    
    -- Check if this is Solicitud Control de Gestión task
    IF EXISTS (
      SELECT 1
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE t.id = NEW.task_id
      AND s.flow_id = v_flow_id
      AND s.name = 'Aprobación Control de Gestión'
      AND t.name = 'Solicitud Control de Gestión'
    ) THEN
      -- Get VB Control de Gestión task ID
      SELECT t.id INTO v_vb_control_gestion_task_id
      FROM payment_flow_tasks t
      JOIN payment_flow_stages s ON s.id = t.stage_id
      WHERE s.flow_id = v_flow_id
      AND s.name = 'Aprobación Control de Gestión'
      AND t.name = 'VB Control de Gestión';
      
      -- Get commission_flow_task ID for VB Control de Gestión
      SELECT id INTO v_vb_control_gestion_flow_task_id
      FROM commission_flow_tasks
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_vb_control_gestion_task_id;
      
      -- If task exists, update its start date
      IF v_vb_control_gestion_flow_task_id IS NOT NULL THEN
        -- Update the task directly (trigger is disabled)
        UPDATE commission_flow_tasks
        SET 
          started_at = NEW.completed_at,
          status = CASE 
            WHEN status = 'blocked' THEN 'pending'
            ELSE status
          END
        WHERE id = v_vb_control_gestion_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for Solicitud Control de Gestión completion
DROP TRIGGER IF EXISTS on_solicitud_control_gestion_completion ON commission_flow_tasks;
CREATE TRIGGER on_solicitud_control_gestion_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_solicitud_control_gestion_completion();

-- Fix existing task dates for in-progress flows
DO $$
DECLARE
  v_flow record;
  v_task_pairs record;
  v_source_task_id uuid;
  v_source_flow_task_id uuid;
  v_source_completed_at timestamptz;
  v_target_task_id uuid;
  v_target_flow_task_id uuid;
BEGIN
  -- Define task pairs to synchronize (source task -> target task)
  FOR v_task_pairs IN (
    SELECT 
      source_stage.name as source_stage_name,
      source_task.name as source_task_name,
      target_stage.name as target_stage_name,
      target_task.name as target_task_name
    FROM (VALUES
      ('Aprobación Jefe Inversiones', 'Solicitud a Jefe Inversiones', 'Aprobación Jefe Inversiones', 'VB Jefe Inversiones'),
      ('Aprobación Jefe Inversiones', 'VB Jefe Inversiones', 'Aprobación Gerente Comercial', 'Solicitud Gerente Comercial'),
      ('Aprobación Gerente Comercial', 'Solicitud Gerente Comercial', 'Aprobación Gerente Comercial', 'VB Gerente Comercial'),
      ('Aprobación Gerente Comercial', 'VB Gerente Comercial', 'Aprobación Control de Gestión', 'Solicitud Control de Gestión'),
      ('Aprobación Control de Gestión', 'Solicitud Control de Gestión', 'Aprobación Control de Gestión', 'VB Control de Gestión'),
      ('Aprobación Control de Gestión', 'VB Control de Gestión', 'Orden de Compra', 'Generación de OC'),
      ('Aprobación Operaciones', 'Solicitud Operaciones', 'Aprobación Operaciones', 'VB Operaciones')
    ) AS pairs(source_stage_name, source_task_name, target_stage_name, target_task_name)
    JOIN payment_flow_stages source_stage ON source_stage.name = pairs.source_stage_name
    JOIN payment_flow_tasks source_task ON source_task.stage_id = source_stage.id AND source_task.name = pairs.source_task_name
    JOIN payment_flow_stages target_stage ON target_stage.name = pairs.target_stage_name AND target_stage.flow_id = source_stage.flow_id
    JOIN payment_flow_tasks target_task ON target_task.stage_id = target_stage.id AND target_task.name = pairs.target_task_name
  ) LOOP
    -- For each commission flow
    FOR v_flow IN 
      SELECT cf.id, cf.flow_id
      FROM commission_flows cf
      WHERE cf.status = 'in_progress'
    LOOP
      -- Get source task
      SELECT pft.id, cft.id, cft.completed_at 
      INTO v_source_task_id, v_source_flow_task_id, v_source_completed_at
      FROM payment_flow_tasks pft
      JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
      LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
      WHERE pfs.flow_id = v_flow.flow_id
      AND pfs.name = v_task_pairs.source_stage_name
      AND pft.name = v_task_pairs.source_task_name
      AND cft.status = 'completed';
      
      -- If found completed source task
      IF v_source_task_id IS NOT NULL AND v_source_completed_at IS NOT NULL THEN
        -- Get target task
        SELECT pft.id, cft.id 
        INTO v_target_task_id, v_target_flow_task_id
        FROM payment_flow_tasks pft
        JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
        LEFT JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = v_flow.id
        WHERE pfs.flow_id = v_flow.flow_id
        AND pfs.name = v_task_pairs.target_stage_name
        AND pft.name = v_task_pairs.target_task_name;
        
        -- If target task exists, update its start date
        IF v_target_flow_task_id IS NOT NULL THEN
          -- Update the task directly (trigger is disabled)
          UPDATE commission_flow_tasks
          SET started_at = v_source_completed_at
          WHERE id = v_target_flow_task_id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;