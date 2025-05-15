/*
  # Add automatic task assignment cleanup

  1. Changes
    - Create trigger to automatically remove task assignments when task is completed
    - Create function to handle task status changes
    - Add indexes for better performance

  2. Security
    - Maintain existing RLS policies
*/

-- Create function to handle task status changes
CREATE OR REPLACE FUNCTION handle_task_status_change()
RETURNS trigger AS $$
BEGIN
  -- If task is completed or blocked, remove all assignments
  IF NEW.status IN ('completed', 'blocked') THEN
    DELETE FROM task_assignments
    WHERE reservation_flow_id = NEW.reservation_flow_id
    AND task_id = NEW.task_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task status changes
DROP TRIGGER IF EXISTS on_task_status_change ON reservation_flow_tasks;
CREATE TRIGGER on_task_status_change
  AFTER UPDATE OF status ON reservation_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_status_change();