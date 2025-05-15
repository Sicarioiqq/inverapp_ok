/*
  # Add fields to task_comments table

  1. New Fields
    - `title` (text) - Title of the comment
    - `status` (text) - Status of the task (PENDIENTE, SIN GESTION REQUERIDA, EN PROCESO, COMPLETADA)

  2. Changes
    - Add check constraint for status values
    - Make title required
*/

-- Add new columns
ALTER TABLE task_comments
  ADD COLUMN title text NOT NULL,
  ADD COLUMN status text NOT NULL DEFAULT 'PENDIENTE';

-- Add check constraint for status
ALTER TABLE task_comments
  ADD CONSTRAINT task_comments_status_check 
  CHECK (status IN ('PENDIENTE', 'SIN GESTION REQUERIDA', 'EN PROCESO', 'COMPLETADA'));