/*
  # Add brokers management

  1. New Tables
    - `brokers`
      - `id` (uuid, primary key)
      - `rut` (text, unique) - RUT del broker
      - `name` (text) - Nombre del broker
      - `business_name` (text) - Razón social
      - `legal_representative` (text) - Representante legal
      - `legal_representative_rut` (text) - RUT representante legal
      - `commercial_address` (text) - Dirección comercial
      - `commercial_address_commune` (text) - Comuna dirección comercial
      - `commercial_contact_name` (text) - Nombre contacto comercial
      - `commercial_contact_phone` (text) - Teléfono contacto comercial
      - `commercial_contact_email` (text) - Correo contacto comercial
      - `constitution_date` (date) - Fecha escritura constitución
      - `constitution_notary` (text) - Notaría constitución
      - `operations_contact_name` (text) - Nombre contacto operaciones
      - `operations_contact_phone` (text) - Teléfono contacto operaciones
      - `operations_contact_email` (text) - Correo contacto operaciones
      - `finance_contact_name` (text) - Nombre contacto finanzas
      - `finance_contact_email` (text) - Correo contacto finanzas
      - `kam_name` (text) - Nombre KAM
      - `kam_phone` (text) - Teléfono KAM
      - `kam_email` (text) - Correo KAM
      - `kam_receives_commission` (boolean) - KAM puede recibir comisiones
      - Audit fields (created_at, updated_at, created_by, updated_by)

  2. Changes to Reservations
    - Add broker fields to reservations table
    
  3. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create brokers table
CREATE TABLE brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut text UNIQUE NOT NULL,
  name text NOT NULL,
  business_name text NOT NULL,
  legal_representative text NOT NULL,
  legal_representative_rut text NOT NULL,
  commercial_address text NOT NULL,
  commercial_address_commune text NOT NULL,
  commercial_contact_name text NOT NULL,
  commercial_contact_phone text,
  commercial_contact_email text,
  constitution_date date NOT NULL,
  constitution_notary text NOT NULL,
  operations_contact_name text,
  operations_contact_phone text,
  operations_contact_email text,
  finance_contact_name text,
  finance_contact_email text,
  kam_name text NOT NULL,
  kam_phone text,
  kam_email text,
  kam_receives_commission boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX brokers_name_idx ON brokers (name);
CREATE INDEX brokers_rut_idx ON brokers (rut);

-- Add broker field to reservations
ALTER TABLE reservations 
  ADD COLUMN is_with_broker boolean DEFAULT false,
  ADD COLUMN broker_id uuid REFERENCES brokers(id);

-- Enable RLS
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver brokers"
  ON brokers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear brokers"
  ON brokers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar brokers"
  ON brokers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_brokers_updated_at
  BEFORE UPDATE ON brokers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();