/*
  # Create real estate agencies table

  1. New Tables
    - `real_estate_agencies`
      - `id` (uuid, primary key)
      - `rut` (text, unique)
      - `business_name` (text)
      - `bank` (text)
      - `account_type` (text)
      - `account_number` (text)
      - Audit fields (created_at, updated_at, created_by, updated_by)

  2. Security
    - Enable RLS on `real_estate_agencies` table
    - Add policies for authenticated users
*/

CREATE TABLE real_estate_agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut text UNIQUE NOT NULL,
  business_name text NOT NULL,
  bank text NOT NULL,
  account_type text NOT NULL,
  account_number text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Crear índices para búsqueda
CREATE INDEX real_estate_agencies_business_name_idx ON real_estate_agencies (business_name);

-- Habilitar Row Level Security
ALTER TABLE real_estate_agencies ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
CREATE POLICY "Usuarios autenticados pueden ver inmobiliarias" ON real_estate_agencies
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear inmobiliarias" ON real_estate_agencies
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar inmobiliarias" ON real_estate_agencies
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Crear trigger para actualizar el timestamp
CREATE TRIGGER update_real_estate_agencies_updated_at
  BEFORE UPDATE ON real_estate_agencies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();