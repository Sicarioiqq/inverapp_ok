/*
  # Create RLS policies for project_commercial_policies table

  1. Security
    - Enable RLS on project_commercial_policies table if not already enabled
    - Add policies for authenticated users to perform CRUD operations
*/

-- Enable Row Level Security
ALTER TABLE IF EXISTS project_commercial_policies ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can read project_commercial_policies"
  ON project_commercial_policies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert project_commercial_policies"
  ON project_commercial_policies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update project_commercial_policies"
  ON project_commercial_policies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete project_commercial_policies"
  ON project_commercial_policies
  FOR DELETE
  TO authenticated
  USING (true);