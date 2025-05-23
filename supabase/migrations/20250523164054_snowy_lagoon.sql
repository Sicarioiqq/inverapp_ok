/*
  # Create Project Commercial Policies Table

  1. New Tables
    - `project_commercial_policies` - Stores commercial policy settings for each project
      - `id` (uuid, primary key)
      - `project_name` (varchar, unique)
      - `monto_reserva_pesos` (numeric)
      - `bono_pie_max_pct` (numeric)
      - `fecha_tope` (date)
      - `observaciones` (text)
      - `comuna` (varchar)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  2. Indexes
    - Index on `project_name` for faster lookups
  3. Triggers
    - Trigger to automatically update the `updated_at` column
*/

CREATE TABLE IF NOT EXISTS project_commercial_policies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_name character varying(255) NOT NULL UNIQUE,
  monto_reserva_pesos numeric(10,0) DEFAULT 0,
  bono_pie_max_pct numeric(5,4) DEFAULT 0.0000,
  fecha_tope date,
  observaciones text,
  comuna character varying(255),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create an index for faster lookups by project name
CREATE INDEX IF NOT EXISTS idx_project_commercial_policies_project_name ON project_commercial_policies (project_name);

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop the trigger if it already exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_project_commercial_policies_updated_at'
  ) THEN
    DROP TRIGGER update_project_commercial_policies_updated_at ON project_commercial_policies;
  END IF;
END
$$;

-- Create the trigger
CREATE TRIGGER update_project_commercial_policies_updated_at
BEFORE UPDATE ON project_commercial_policies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE project_commercial_policies ENABLE ROW LEVEL SECURITY;

-- Allow read access for all authenticated users
CREATE POLICY "Enable read access for all authenticated users"
  ON project_commercial_policies
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow write access for admin users only
CREATE POLICY "Enable write access for admin users only"
  ON project_commercial_policies
  FOR ALL
  TO public
  USING ((jwt() ->> 'user_role'::text) = 'admin'::text)
  WITH CHECK ((jwt() ->> 'user_role'::text) = 'admin'::text);

-- Allow authenticated users to perform all operations
CREATE POLICY "Authenticated users can delete project_commercial_policies"
  ON project_commercial_policies
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert project_commercial_policies"
  ON project_commercial_policies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read project_commercial_policies"
  ON project_commercial_policies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update project_commercial_policies"
  ON project_commercial_policies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);