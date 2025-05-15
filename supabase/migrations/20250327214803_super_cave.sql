/*
  # Fix payment flow completion logic

  1. Changes
    - Update trigger function to only complete flow when last task is completed
    - Add function to check if task is last in flow
    - Maintain existing task status handling
    
  2. Security
    - Maintain existing RLS policies
*/

-- Create function to check if task is last in flow
CREATE OR REPLACE FUNCTION is_last_payment_task(p_task_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE t.id = p_task_id
    AND t.name = 'Fecha de Pago'
    AND s.name = 'Pago'
  );
END;
$$ LANGUAGE plpgsql;

-- Update trigger function to handle flow completion
CREATE OR REPLACE FUNCTION update_commission_flow_status()
RETURNS trigger AS $$
DECLARE
  v_is_last_task boolean;
  v_all_tasks_completed boolean;
BEGIN
  -- Check if the current task is the last task (Fecha de Pago)
  SELECT is_last_payment_task(NEW.task_id) INTO v_is_last_task;
  
  -- Check if all tasks are completed
  SELECT NOT EXISTS (
    SELECT 1 
    FROM commission_flow_tasks 
    WHERE commission_flow_id = NEW.commission_flow_id 
    AND status != 'completed'
  ) INTO v_all_tasks_completed;

  -- Only complete the flow if:
  -- 1. The current task is the last task (Fecha de Pago)
  -- 2. The current task is being completed
  -- 3. All other tasks are already completed
  IF v_is_last_task AND NEW.status = 'completed' AND v_all_tasks_completed THEN
    UPDATE commission_flows
    SET 
      status = 'completed',
      completed_at = now()
    WHERE id = NEW.commission_flow_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_update_commission_flow_status ON commission_flow_tasks;
CREATE TRIGGER trigger_update_commission_flow_status
  AFTER INSERT OR UPDATE OF status ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_flow_status();

-- Reset any incorrectly completed flows
UPDATE commission_flows cf
SET 
  status = 'in_progress',
  completed_at = NULL
WHERE status = 'completed'
AND NOT EXISTS (
  SELECT 1 
  FROM commission_flow_tasks cft
  JOIN payment_flow_tasks pft ON pft.id = cft.task_id
  JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
  WHERE cft.commission_flow_id = cf.id
  AND pft.name = 'Fecha de Pago'
  AND pfs.name = 'Pago'
  AND cft.status = 'completed'
);