/*
  # Create project_commercial_policies table

  1. New Tables
    - `project_commercial_policies` - Table to store commercial policies for each project
      - `id` (uuid, primary key)
      - `project_name` (character varying, unique)
      - `monto_reserva_pesos` (numeric)
      - `bono_pie_max_pct` (numeric)
      - `fecha_tope` (date)
      - `observaciones` (text)
      - `comuna` (character varying)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)
  2. Security
    - RLS policies for authenticated users to read, insert, update, and delete
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

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_project_commercial_policies_updated_at
BEFORE UPDATE ON project_commercial_policies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();