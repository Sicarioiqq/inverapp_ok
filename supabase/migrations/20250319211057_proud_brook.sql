/*
  # Fix task comments table structure and relationships

  1. Changes
    - Drop existing task_comments table
    - Recreate with proper relationships and constraints
    - Add proper indexes and policies
    - Ensure ON DELETE CASCADE for proper cleanup

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Drop existing table
DROP TABLE IF EXISTS task_comments CASCADE;

-- Create task_comments table
CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_flow_task_id uuid REFERENCES reservation_flow_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'SIN GESTION REQUERIDA', 'EN PROCESO', 'COMPLETADA')),
  mentioned_users uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX task_comments_reservation_flow_task_id_idx ON task_comments(reservation_flow_task_id);
CREATE INDEX task_comments_user_id_idx ON task_comments(user_id);
CREATE INDEX task_comments_status_idx ON task_comments(status);

-- Enable RLS
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver comentarios"
  ON task_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear comentarios"
  ON task_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();