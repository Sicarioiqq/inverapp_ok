/*
  # Add comment deletion policy for administrators

  1. Changes
    - Add DELETE policy for task_comments table
    - Only administrators can delete comments
    
  2. Security
    - Maintain existing policies
    - Restrict deletion to administrators only
*/

-- Drop existing delete policy if exists
DROP POLICY IF EXISTS "Administradores pueden eliminar comentarios" ON task_comments;

-- Create new delete policy for administrators
CREATE POLICY "Administradores pueden eliminar comentarios"
  ON task_comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  );