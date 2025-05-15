/*
  # Add trigger to sync VB Jefe Inversiones task date with Solicitud a Jefe Inversiones completion date

  1. New Functionality
    - Create a trigger to automatically set the started_at date of "VB Jefe Inversiones" task
      to match the completed_at date of "Solicitud a Jefe Inversiones" task
    - This ensures proper date tracking between related tasks
    
  2. Changes
    - Add new trigger function to handle the date synchronization
    - Add trigger to commission_flow_tasks table
    
  3. Security
    - No changes to RLS policies required
*/

-- Create function to handle VB Jefe completion
CREATE OR REPLACE FUNCTION handle_vb_jefe_completion()
RETURNS trigger AS $$
DECLARE
  v_vb_jefe_task_id uuid;
  v_vb_jefe_flow_task_id uuid;
BEGIN
  -- Only proceed if Solicitud a Jefe Inversiones task is being completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.completed_at IS NOT NULL THEN
    -- Check if this is the Solicitud a Jefe Inversiones task
    SELECT t.id INTO v_vb_jefe_task_id
    FROM payment_flow_tasks t
    JOIN payment_flow_stages s ON s.id = t.stage_id
    WHERE s.name = 'Aprobación Jefe Inversiones'
    AND t.name = 'VB Jefe Inversiones';
    
    IF v_vb_jefe_task_id IS NOT NULL THEN
      -- Find the corresponding VB Jefe Inversiones task for this flow
      SELECT cft.id INTO v_vb_jefe_flow_task_id
      FROM commission_flow_tasks cft
      WHERE cft.commission_flow_id = NEW.commission_flow_id
      AND cft.task_id = v_vb_jefe_task_id;
      
      -- If found, update its started_at date to match the completed_at of Solicitud a Jefe Inversiones
      IF v_vb_jefe_flow_task_id IS NOT NULL THEN
        UPDATE commission_flow_tasks
        SET started_at = NEW.completed_at
        WHERE id = v_vb_jefe_flow_task_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for VB Jefe completion
DROP TRIGGER IF EXISTS on_vb_jefe_completion ON commission_flow_tasks;
CREATE TRIGGER on_vb_jefe_completion
  AFTER UPDATE OF status, completed_at ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_vb_jefe_completion();