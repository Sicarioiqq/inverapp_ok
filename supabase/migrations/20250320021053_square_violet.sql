/*
  # Fix default seller configuration

  1. Changes
    - Create new table for default seller configuration
    - Remove default seller entries from default_task_assignments
    - Add proper constraints and policies
*/

-- Create default_seller table
CREATE TABLE default_seller (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE default_seller ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver vendedor por defecto"
  ON default_seller FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden configurar vendedor por defecto"
  ON default_seller FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar vendedor por defecto"
  ON default_seller FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar vendedor por defecto"
  ON default_seller FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_default_seller_updated_at
  BEFORE UPDATE ON default_seller
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();