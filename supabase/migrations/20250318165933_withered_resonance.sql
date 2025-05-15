/*
  # Create Broker Commissions Table

  1. New Table
    - `broker_commissions`
      - `id` (uuid, primary key)
      - `reservation_id` (uuid) - Reference to reservation
      - `broker_id` (uuid) - Reference to broker
      - `commission_amount` (numeric) - Amount in UF
      - `commission_includes_tax` (boolean) - Whether commission includes VAT
      - `commission_for_discount` (boolean) - Whether commission applies to discount
      - `pays_secondary` (boolean) - Whether broker pays secondary commissions
      - `net_commission` (numeric) - Calculated net commission
      - `number_of_payments` (integer) - Number of payments (1 or 2)
      - `first_payment_percentage` (numeric) - Percentage for first payment (25, 50, or 100)
      - Audit fields

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE broker_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) NOT NULL,
  broker_id uuid REFERENCES brokers(id) NOT NULL,
  commission_amount numeric NOT NULL DEFAULT 0,
  commission_includes_tax boolean NOT NULL DEFAULT true,
  commission_for_discount boolean NOT NULL DEFAULT true,
  pays_secondary boolean NOT NULL DEFAULT false,
  net_commission numeric GENERATED ALWAYS AS (
    CASE 
      WHEN commission_includes_tax THEN commission_amount / 1.19
      ELSE commission_amount
    END
  ) STORED,
  number_of_payments integer NOT NULL DEFAULT 1 CHECK (number_of_payments IN (1, 2)),
  first_payment_percentage numeric NOT NULL DEFAULT 100 CHECK (first_payment_percentage IN (25, 50, 100)),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(reservation_id)
);

-- Enable RLS
ALTER TABLE broker_commissions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver comisiones"
  ON broker_commissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear comisiones"
  ON broker_commissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar comisiones"
  ON broker_commissions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_broker_commissions_updated_at
  BEFORE UPDATE ON broker_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();