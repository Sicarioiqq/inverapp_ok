/*
  # Add trigger to sync VB Operaciones task date with Solicitud Operaciones completion date

  1. New Functionality
    - Create a trigger to automatically set the started_at date of "VB Operaciones" task
      to match the completed_at date of "Solicitud Operaciones" task
    - This ensures proper date tracking between related tasks
    
  2. Changes
    - Add new trigger function to handle the date synchronization
    - Add trigger to commission_flow_tasks table
    
  3. Security
    - No changes to RLS policies required
*/

-- Create function to handle Solicitud Operaciones completion
CREATE OR REPLACE FUNCTION handle_solicitud_operaciones_completion()
RETURNS trigger AS $$
DECLARE
  v_vb_operaciones_task_id uuid;
  v_vb_operaciones_flow_task_id uuid;
BEGIN
  -- Only proceed if Solicitud Operaciones task is being completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.completed_at IS NOT NULL THEN
    -- Check if this is the Solicitud Operaciones task
    SELECT t.id INTO v_vb_operaciones_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.name = 'Aprobación Operaciones'
    AND t.name = 'VB Operaciones';
    
    IF v_vb_operaciones_task_id IS NOT NULL THEN
      -- Find the corresponding VB Operaciones task for this flow
      SELECT cft.id INTO v_vb_operaciones_flow_task_id
      FROM commission_flow_tasks cft
      WHERE cft.commission_flow_id = NEW.commission_flow_id
      AND cft.task_id = v_vb_operaciones_task_id;
      
      -- If found, update its started_at date to match the completed_at of Solicitud Operaciones
      IF v_vb_operaciones_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET started_at = NEW.completed_at
        WHERE id = v_vb_operaciones_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Solicitud Operaciones completion
DROP TRIGGER IF EXISTS on_solicitud_operaciones_completion ON commission_flow_tasks;
CREATE TRIGGER on_solicitud_operaciones_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_solicitud_operaciones_completion();