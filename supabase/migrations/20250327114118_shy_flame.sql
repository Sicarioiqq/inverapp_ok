/*
  # Fix payment flow completion logic

  1. Changes
    - Add trigger to update flow status when all tasks are completed
    - Ensure proper task status handling
    - Maintain data integrity
*/

-- Create trigger function to update flow status based on task completion
CREATE OR REPLACE FUNCTION update_commission_flow_status()
RETURNS trigger AS $$
BEGIN
  -- If all tasks are completed, mark the flow as completed
  IF EXISTS (
    SELECT 1 FROM commission_flow_tasks
    WHERE commission_flow_id = NEW.commission_flow_id
    AND status = 'completed'
  ) AND NOT EXISTS (
    SELECT 1 FROM commission_flow_tasks
    WHERE commission_flow_id = NEW.commission_flow_id
    AND status != 'completed'
  ) THEN
    UPDATE commission_flows
    SET 
      status = 'completed',
      completed_at = now()
    WHERE id = NEW.commission_flow_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task status changes
DROP TRIGGER IF EXISTS trigger_update_commission_flow_status ON commission_flow_tasks;
CREATE TRIGGER trigger_update_commission_flow_status
  AFTER INSERT OR UPDATE OF status ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_flow_status();

-- Fix any existing flows that might be incorrectly marked as completed
UPDATE commission_flows cf
SET 
  status = CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM commission_flow_tasks cft 
      WHERE cft.commission_flow_id = cf.id 
      AND cft.status != 'completed'
    ) THEN 'in_progress'
    ELSE status
  END,
  completed_at = CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM commission_flow_tasks cft 
      WHERE cft.commission_flow_id = cf.id 
      AND cft.status != 'completed'
    ) THEN NULL
    ELSE completed_at
  END
WHERE status = 'completed';