/*
  # Fix task_assignments schema and triggers

  1. Changes
    - Check if commission_flow_id column exists in task_assignments table
    - If it exists, drop it to prevent conflicts with reservation_flow_id
    - Update handle_task_assignment function to use reservation_flow_id only
    - Recreate trigger to ensure proper behavior
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- First, check if the commission_flow_id column exists in the task_assignments table
DO $$ 
BEGIN
  -- Check if the column exists
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

-- Make sure reservation_flow_id exists and has proper foreign key constraint
-- Skip adding the constraint since it already exists
DO $$
BEGIN
  -- Check if reservation_flow_id column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'task_assignments' 
    AND column_name = 'reservation_flow_id'
  ) THEN
    -- Add the column if it doesn't exist
    ALTER TABLE task_assignments ADD COLUMN reservation_flow_id uuid NOT NULL;
    
    -- Add the foreign key constraint
    ALTER TABLE task_assignments 
    ADD CONSTRAINT task_assignments_reservation_flow_id_fkey 
    FOREIGN KEY (reservation_flow_id) 
    REFERENCES reservation_flows(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Update the handle_task_assignment function to use reservation_flow_id only
CREATE OR REPLACE FUNCTION handle_task_assignment()
RETURNS trigger AS $$
BEGIN
  -- Update assigned_at in reservation_flow_tasks when a user is assigned
  UPDATE reservation_flow_tasks
  SET 
    assigned_at = COALESCE(assigned_at, now()),
    assignee_id = CASE 
      -- If this is the only assignment, set the assignee_id
      WHEN (
        SELECT COUNT(*) 
        FROM task_assignments 
        WHERE reservation_flow_id = NEW.reservation_flow_id 
        AND task_id = NEW.task_id
      ) = 1 THEN NEW.user_id
      -- Otherwise, leave it as is or set to NULL if there are multiple assignments
      ELSE NULL
    END
  WHERE reservation_flow_id = NEW.reservation_flow_id
  AND task_id = NEW.task_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_task_assignment ON task_assignments;

-- Create trigger for task assignments
CREATE TRIGGER on_task_assignment
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_assignment();

-- Add unique constraint to prevent duplicate assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'task_assignments_reservation_flow_id_task_id_user_id_key'
  ) THEN
    ALTER TABLE task_assignments 
    ADD CONSTRAINT task_assignments_reservation_flow_id_task_id_user_id_key 
    UNIQUE (reservation_flow_id, task_id, user_id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_assignments_reservation_flow_id 
ON task_assignments(reservation_flow_id);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id 
ON task_assignments(task_id);

CREATE INDEX IF NOT EXISTS idx_task_assignments_user_id 
ON task_assignments(user_id);

-- Fix any existing data issues
UPDATE task_assignments
SET assigned_by = user_id
WHERE assigned_by IS NULL;