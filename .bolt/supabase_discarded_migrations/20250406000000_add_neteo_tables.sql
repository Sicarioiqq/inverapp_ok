/*
  # Add Neteo Castigos Schema

  1. New Tables
    - `neteos`
      - `id` (uuid, primary key)
      - `unidad_absorbente_id` (uuid) - Reference to broker_commissions
      - `fecha_neteo` (timestamptz) - Fecha del neteo
      - `monto_total_neteado` (numeric) - Monto total neteado
      - Audit fields

    - `neteo_detalles`
      - `id` (uuid, primary key)
      - `neteo_id` (uuid) - Reference to neteos
      - `unidad_castigada_id` (uuid) - Reference to broker_commissions
      - `monto_castigo` (numeric) - Monto del castigo neteado
      - Audit fields

  2. Modifications
    - Add columns to broker_commissions:
      - `es_neteador` (boolean) - Indica si la unidad absorbe castigos
      - `es_neteada` (boolean) - Indica si la unidad fue neteada

  3. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create neteos table
CREATE TABLE neteos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_absorbente_id uuid REFERENCES broker_commissions(id) NOT NULL,
  fecha_neteo timestamptz DEFAULT now(),
  monto_total_neteado numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create neteo_detalles table
CREATE TABLE neteo_detalles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  neteo_id uuid REFERENCES neteos(id) ON DELETE CASCADE NOT NULL,
  unidad_castigada_id uuid REFERENCES broker_commissions(id) NOT NULL,
  monto_castigo numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Add columns to broker_commissions
ALTER TABLE broker_commissions
ADD COLUMN es_neteador boolean DEFAULT false,
ADD COLUMN es_neteada boolean DEFAULT false;

-- Create indexes
CREATE INDEX neteos_unidad_absorbente_id_idx ON neteos(unidad_absorbente_id);
CREATE INDEX neteo_detalles_neteo_id_idx ON neteo_detalles(neteo_id);
CREATE INDEX neteo_detalles_unidad_castigada_id_idx ON neteo_detalles(unidad_castigada_id);

-- Enable RLS
ALTER TABLE neteos ENABLE ROW LEVEL SECURITY;
ALTER TABLE neteo_detalles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver neteos"
  ON neteos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear neteos"
  ON neteos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden ver detalles de neteo"
  ON neteo_detalles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear detalles de neteo"
  ON neteo_detalles FOR INSERT
  TO authenticated
  WITH CHECK (true); 