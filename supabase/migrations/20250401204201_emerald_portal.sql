/*
  # Add assignee_id column to reservation_flow_tasks table

  1. Changes
    - Add assignee_id column to reservation_flow_tasks table
    - Add foreign key constraint to profiles table
    - Add index for better performance
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add assignee_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservation_flow_tasks' 
    AND column_name = 'assignee_id'
  ) THEN
    -- Add the assignee_id column
    ALTER TABLE reservation_flow_tasks 
    ADD COLUMN assignee_id uuid REFERENCES profiles(id);
    
    -- Create index for better performance
    CREATE INDEX idx_reservation_flow_tasks_assignee_id 
    ON reservation_flow_tasks(assignee_id);
  END IF;
END $$;