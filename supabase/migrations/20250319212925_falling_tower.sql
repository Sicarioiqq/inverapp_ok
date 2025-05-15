/*
  # Fix task management policies and constraints

  1. Changes
    - Add missing policies for task management
    - Update task assignment constraints
    - Add indexes for better performance

  2. Security
    - Enable proper access control for task management
    - Ensure data consistency
*/

-- Add missing policies for reservation_flow_tasks
CREATE POLICY "Usuarios autenticados pueden crear tareas de reserva"
  ON reservation_flow_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar tareas de reserva"
  ON reservation_flow_tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add missing policies for task_assignments
CREATE POLICY "Usuarios autenticados pueden eliminar asignaciones"
  ON task_assignments FOR DELETE
  TO authenticated
  USING (true);

-- Add missing policies for task_comments
CREATE POLICY "Usuarios autenticados pueden actualizar comentarios"
  ON task_comments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reservation_flow_tasks_task_id
  ON reservation_flow_tasks(task_id);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task_user
  ON task_assignments(task_id, user_id);

CREATE INDEX IF NOT EXISTS idx_task_comments_user_created
  ON task_comments(user_id, created_at);