/*
  # Add default task assignments table

  1. New Table
    - `default_task_assignments`
      - `id` (uuid, primary key)
      - `task_id` (uuid) - Reference to sale_flow_tasks
      - `user_id` (uuid) - Reference to profiles
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid)
      - `updated_by` (uuid)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create default_task_assignments table
CREATE TABLE default_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES sale_flow_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(task_id, user_id)
);

-- Create indexes
CREATE INDEX default_task_assignments_task_id_idx ON default_task_assignments(task_id);
CREATE INDEX default_task_assignments_user_id_idx ON default_task_assignments(user_id);

-- Enable RLS
ALTER TABLE default_task_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver asignaciones por defecto"
  ON default_task_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear asignaciones por defecto"
  ON default_task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar asignaciones por defecto"
  ON default_task_assignments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar asignaciones por defecto"
  ON default_task_assignments FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_default_task_assignments_updated_at
  BEFORE UPDATE ON default_task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();