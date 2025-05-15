/*
  # Update task comments schema

  1. Changes
    - Remove title and status fields from task_comments table
    - Update existing data
    - Maintain foreign key relationships and policies
*/

-- First, remove the title and status columns
ALTER TABLE task_comments
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS status;