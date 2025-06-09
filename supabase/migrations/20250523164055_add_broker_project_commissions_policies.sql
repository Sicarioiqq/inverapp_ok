/*
  # Add RLS policies for broker_project_commissions table

  1. Security
    - Enable RLS on broker_project_commissions table
    - Add policies for authenticated users to perform CRUD operations
    - Ensure brokers can only access their own commission rates
*/

-- Enable Row Level Security
ALTER TABLE IF EXISTS broker_project_commissions ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Brokers can read their own commission rates"
  ON broker_project_commissions
  FOR SELECT
  TO authenticated
  USING (
    broker_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  );

CREATE POLICY "Administrators can manage commission rates"
  ON broker_project_commissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  ); 