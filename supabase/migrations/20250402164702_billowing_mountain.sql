/*
  # Fix task assignments schema and triggers

  1. Changes
    - Ensure task_assignments table has correct columns
    - Remove any references to commission_flow_id
    - Update triggers to handle task assignments correctly
    - Fix any existing data issues
*/

-- First, check if there are any issues with the task_assignments table
DO $$ 
BEGIN
  -- Check if the column exists in the table
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'task_assignments' 
    AND column_name = 'commission_flow_id'
  ) THEN
    -- Drop the column if it exists
    ALTER TABLE task_assignments DROP COLUMN commission_flow_id;
  END IF;
END $$;

-- Update the handle_task_assignment function to remove any references to commission_flow_id
CREATE OR REPLACE FUNCTION handle_task_assignment()
RETURNS trigger AS $$
BEGIN
  -- Update assigned_at in reservation_flow_tasks when first user is assigned
  UPDATE reservation_flow_tasks
  SET assigned_at = COALESCE(assigned_at, now())
  WHERE reservation_flow_id = NEW.reservation_flow_id
  AND task_id = NEW.task_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_task_assignment ON task_assignments;
CREATE TRIGGER on_task_assignment
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_assignment();

-- Fix any existing data issues
UPDATE task_assignments
SET assigned_by = user_id
WHERE assigned_by IS NULL;