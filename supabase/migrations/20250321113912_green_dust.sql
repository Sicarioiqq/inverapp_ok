/*
  # Add promotions schema

  1. New Tables
    - `promotions`
      - `id` (uuid, primary key)
      - `reservation_id` (uuid) - Reference to reservation
      - `amount` (numeric) - Amount in UF
      - `beneficiary` (text) - Beneficiary name
      - `rut` (text) - Beneficiary RUT
      - `bank` (text) - Bank name
      - `account_type` (text) - Account type
      - `account_number` (text) - Account number
      - `email` (text) - Email for payment notification
      - `purchase_order` (text) - Purchase order number
      - `document_number` (text) - Document number (boleta/factura)
      - `document_date` (date) - Document emission date
      - `payment_date` (date) - Payment date
      - Audit fields

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create promotions table
CREATE TABLE promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  beneficiary text NOT NULL,
  rut text NOT NULL,
  bank text NOT NULL,
  account_type text NOT NULL,
  account_number text NOT NULL,
  email text NOT NULL,
  purchase_order text,
  document_number text,
  document_date date,
  payment_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX promotions_reservation_id_idx ON promotions(reservation_id);
CREATE INDEX promotions_rut_idx ON promotions(rut);

-- Enable RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver promociones"
  ON promotions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear promociones"
  ON promotions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar promociones"
  ON promotions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();