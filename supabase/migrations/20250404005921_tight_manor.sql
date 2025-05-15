-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Create a function to handle Generación de OC automation
CREATE OR REPLACE FUNCTION handle_generacion_oc_automation()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_vb_gerente_task_id uuid;
  v_vb_gerente_flow_task_id uuid;
  v_vb_gerente_completed_at timestamptz;
  v_vb_gerente_status text;
  v_vb_operaciones_task_id uuid;
  v_vb_operaciones_flow_task_id uuid;
  v_vb_operaciones_completed_at timestamptz;
  v_vb_operaciones_status text;
  v_vb_control_gestion_task_id uuid;
  v_vb_control_gestion_flow_task_id uuid;
  v_vb_control_gestion_started_at timestamptz;
  v_vb_control_gestion_status text;
  v_generacion_oc_task_id uuid;
  v_generacion_oc_flow_task_id uuid;
  v_generacion_oc_status text;
  v_latest_completion_date timestamptz;
  v_control_gestion_days_elapsed integer;
  v_default_assignee_id uuid;
BEGIN
  -- Get flow ID
  SELECT flow_id INTO v_flow_id
  FROM commission_flows
  WHERE id = NEW.commission_flow_id;
  
  -- Get task IDs
  SELECT t.id INTO v_vb_gerente_task_id
  FROM payment_flow_tasks t
  JOIN payment_flow_stages s ON s.id = t.stage_id
  WHERE s.flow_id = v_flow_id
  AND s.name = 'Aprobación Gerente Comercial'
  AND t.name = 'VB Gerente Comercial';
  
  SELECT t.id INTO v_vb_operaciones_task_id
  FROM payment_flow_tasks t
  JOIN payment_flow_stages s ON s.id = t.stage_id
  WHERE s.flow_id = v_flow_id
  AND s.name = 'Aprobación Operaciones'
  AND t.name = 'VB Operaciones';
  
  SELECT t.id INTO v_vb_control_gestion_task_id
  FROM payment_flow_tasks t
  JOIN payment_flow_stages s ON s.id = t.stage_id
  WHERE s.flow_id = v_flow_id
  AND s.name = 'Aprobación Control de Gestión'
  AND t.name = 'VB Control de Gestión';
  
  SELECT t.id, t.default_assignee_id INTO v_generacion_oc_task_id, v_default_assignee_id
  FROM payment_flow_tasks t
  JOIN payment_flow_stages s ON s.id = t.stage_id
  WHERE s.flow_id = v_flow_id
  AND s.name = 'Orden de Compra'
  AND t.name = 'Generación de OC';
  
  -- Get task statuses and completion dates
  SELECT 
    cft.status,
    cft.completed_at
  INTO v_vb_gerente_status, v_vb_gerente_completed_at
  FROM commission_flow_tasks cft
  WHERE cft.commission_flow_id = NEW.commission_flow_id
  AND cft.task_id = v_vb_gerente_task_id;
  
  SELECT 
    cft.status,
    cft.completed_at
  INTO v_vb_operaciones_status, v_vb_operaciones_completed_at
  FROM commission_flow_tasks cft
  WHERE cft.commission_flow_id = NEW.commission_flow_id
  AND cft.task_id = v_vb_operaciones_task_id;
  
  SELECT 
    cft.status,
    cft.started_at
  INTO v_vb_control_gestion_status, v_vb_control_gestion_started_at
  FROM commission_flow_tasks cft
  WHERE cft.commission_flow_id = NEW.commission_flow_id
  AND cft.task_id = v_vb_control_gestion_task_id;
  
  SELECT 
    cft.id,
    cft.status
  INTO v_generacion_oc_flow_task_id, v_generacion_oc_status
  FROM commission_flow_tasks cft
  WHERE cft.commission_flow_id = NEW.commission_flow_id
  AND cft.task_id = v_generacion_oc_task_id;
  
  -- Calculate days elapsed for Control de Gestión
  IF v_vb_control_gestion_started_at IS NOT NULL THEN
    v_control_gestion_days_elapsed := EXTRACT(DAY FROM (now() - v_vb_control_gestion_started_at));
  ELSE
    v_control_gestion_days_elapsed := 0;
  END IF;
  
  -- Check conditions for unblocking Generación de OC
  -- 1. VB Gerente Comercial and VB Operaciones must be completed
  -- 2. Either VB Control de Gestión is completed OR it has been more than 3 days since it started
  IF (v_vb_gerente_status = 'completed' AND v_vb_operaciones_status = 'completed') AND
     (v_vb_control_gestion_status = 'completed' OR v_control_gestion_days_elapsed > 3) THEN
    
    -- Determine the latest completion date
    IF v_vb_gerente_completed_at > v_vb_operaciones_completed_at THEN
      v_latest_completion_date := v_vb_gerente_completed_at;
    ELSE
      v_latest_completion_date := v_vb_operaciones_completed_at;
    END IF;
    
    -- If Generación de OC is blocked, unblock it
    IF v_generacion_oc_flow_task_id IS NOT NULL AND v_generacion_oc_status = 'blocked' THEN
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        started_at = v_latest_completion_date,
        assignee_id = v_default_assignee_id,
        assigned_at = CASE 
          WHEN v_default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END
      WHERE id = v_generacion_oc_flow_task_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for VB Gerente Operaciones completion
DROP TRIGGER IF EXISTS on_vb_gerente_operaciones_completion ON commission_flow_tasks;
CREATE TRIGGER on_vb_gerente_operaciones_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_generacion_oc_automation();

-- Create a function to check overdue tasks and update Generación de OC
CREATE OR REPLACE FUNCTION check_overdue_control_gestion_tasks()
RETURNS void AS $$
DECLARE
  v_flow record;
  v_vb_gerente_task_id uuid;
  v_vb_gerente_flow_task_id uuid;
  v_vb_gerente_completed_at timestamptz;
  v_vb_gerente_status text;
  v_vb_operaciones_task_id uuid;
  v_vb_operaciones_flow_task_id uuid;
  v_vb_operaciones_completed_at timestamptz;
  v_vb_operaciones_status text;
  v_vb_control_gestion_task_id uuid;
  v_vb_control_gestion_flow_task_id uuid;
  v_vb_control_gestion_started_at timestamptz;
  v_vb_control_gestion_status text;
  v_generacion_oc_task_id uuid;
  v_generacion_oc_flow_task_id uuid;
  v_generacion_oc_status text;
  v_latest_completion_date timestamptz;
  v_control_gestion_days_elapsed integer;
  v_default_assignee_id uuid;
BEGIN
  -- For each commission flow in progress
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- Get task IDs
    SELECT t.id INTO v_vb_gerente_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Aprobación Gerente Comercial'
    AND t.name = 'VB Gerente Comercial';
    
    SELECT t.id INTO v_vb_operaciones_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Aprobación Operaciones'
    AND t.name = 'VB Operaciones';
    
    SELECT t.id INTO v_vb_control_gestion_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Aprobación Control de Gestión'
    AND t.name = 'VB Control de Gestión';
    
    SELECT t.id, t.default_assignee_id INTO v_generacion_oc_task_id, v_default_assignee_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.flow_id = v_flow.flow_id
    AND s.name = 'Orden de Compra'
    AND t.name = 'Generación de OC';
    
    -- Get task statuses and completion dates
    SELECT 
      cft.status,
      cft.completed_at
    INTO v_vb_gerente_status, v_vb_gerente_completed_at
    FROM commission_flow_tasks cft
    WHERE cft.commission_flow_id = v_flow.id
    AND cft.task_id = v_vb_gerente_task_id;
    
    SELECT 
      cft.status,
      cft.completed_at
    INTO v_vb_operaciones_status, v_vb_operaciones_completed_at
    FROM commission_flow_tasks cft
    WHERE cft.commission_flow_id = v_flow.id
    AND cft.task_id = v_vb_operaciones_task_id;
    
    SELECT 
      cft.status,
      cft.started_at
    INTO v_vb_control_gestion_status, v_vb_control_gestion_started_at
    FROM commission_flow_tasks cft
    WHERE cft.commission_flow_id = v_flow.id
    AND cft.task_id = v_vb_control_gestion_task_id;
    
    SELECT 
      cft.id,
      cft.status
    INTO v_generacion_oc_flow_task_id, v_generacion_oc_status
    FROM commission_flow_tasks cft
    WHERE cft.commission_flow_id = v_flow.id
    AND cft.task_id = v_generacion_oc_task_id;
    
    -- Calculate days elapsed for Control de Gestión
    IF v_vb_control_gestion_started_at IS NOT NULL THEN
      v_control_gestion_days_elapsed := EXTRACT(DAY FROM (now() - v_vb_control_gestion_started_at));
    ELSE
      v_control_gestion_days_elapsed := 0;
    END IF;
    
    -- Check conditions for unblocking Generación de OC
    -- 1. VB Gerente Comercial and VB Operaciones must be completed
    -- 2. Either VB Control de Gestión is completed OR it has been more than 3 days since it started
    IF (v_vb_gerente_status = 'completed' AND v_vb_operaciones_status = 'completed') AND
       (v_vb_control_gestion_status = 'completed' OR v_control_gestion_days_elapsed > 3) THEN
      
      -- Determine the latest completion date
      IF v_vb_gerente_completed_at > v_vb_operaciones_completed_at THEN
        v_latest_completion_date := v_vb_gerente_completed_at;
      ELSE
        v_latest_completion_date := v_vb_operaciones_completed_at;
      END IF;
      
      -- If Generación de OC is blocked, unblock it
      IF v_generacion_oc_flow_task_id IS NOT NULL AND v_generacion_oc_status = 'blocked' THEN
        UPDATE commission_flow_tasks
        SET 
          status = 'pending',
          started_at = v_latest_completion_date,
          assignee_id = v_default_assignee_id,
          assigned_at = CASE 
            WHEN v_default_assignee_id IS NOT NULL THEN now()
            ELSE NULL
          END
        WHERE id = v_generacion_oc_flow_task_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the function to update existing tasks
SELECT check_overdue_control_gestion_tasks();

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;