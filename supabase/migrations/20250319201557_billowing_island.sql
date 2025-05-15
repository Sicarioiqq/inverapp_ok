/*
  # Fix task assignments and profiles relationships

  1. Changes
    - Drop existing task_assignments table
    - Recreate task_assignments table with correct relationships
    - Add indexes and policies
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Drop existing table
DROP TABLE IF EXISTS task_assignments CASCADE;

-- Recreate task_assignments table with correct relationships
CREATE TABLE task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_flow_task_id uuid REFERENCES reservation_flow_tasks(id) NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(reservation_flow_task_id, user_id)
);

-- Create indexes
CREATE INDEX task_assignments_reservation_flow_task_id_idx ON task_assignments(reservation_flow_task_id);
CREATE INDEX task_assignments_user_id_idx ON task_assignments(user_id);

-- Enable RLS
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver asignaciones"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear asignaciones"
  ON task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar asignaciones"
  ON task_assignments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_task_assignments_updated_at
  BEFORE UPDATE ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();