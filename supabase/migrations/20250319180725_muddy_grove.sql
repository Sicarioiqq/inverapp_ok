/*
  # Add payment tracking fields to broker_commissions if they don't exist

  1. Changes
    - Add columns only if they don't exist
    - Use DO block for conditional column addition
    - Maintain idempotency

  2. Fields to add (if not present):
    - `purchase_order` (text) - N° OC
    - `invoice_1` (text) - N° Factura (primer pago)
    - `invoice_1_date` (date) - Fecha de Emisión (primer pago)
    - `payment_1_date` (date) - Fecha de Pago (primer pago)
    - `invoice_2` (text) - N° Factura (segundo pago)
    - `invoice_2_date` (date) - Fecha de Emisión (segundo pago)
    - `payment_2_date` (date) - Fecha de Pago (segundo pago)
*/

DO $$ 
BEGIN
  -- Add purchase_order column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_commissions' AND column_name = 'purchase_order'
  ) THEN
    ALTER TABLE broker_commissions ADD COLUMN purchase_order text;
  END IF;

  -- Add invoice_1 column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_commissions' AND column_name = 'invoice_1'
  ) THEN
    ALTER TABLE broker_commissions ADD COLUMN invoice_1 text;
  END IF;

  -- Add invoice_1_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_commissions' AND column_name = 'invoice_1_date'
  ) THEN
    ALTER TABLE broker_commissions ADD COLUMN invoice_1_date date;
  END IF;

  -- Add payment_1_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_commissions' AND column_name = 'payment_1_date'
  ) THEN
    ALTER TABLE broker_commissions ADD COLUMN payment_1_date date;
  END IF;

  -- Add invoice_2 column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_commissions' AND column_name = 'invoice_2'
  ) THEN
    ALTER TABLE broker_commissions ADD COLUMN invoice_2 text;
  END IF;

  -- Add invoice_2_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_commissions' AND column_name = 'invoice_2_date'
  ) THEN
    ALTER TABLE broker_commissions ADD COLUMN invoice_2_date date;
  END IF;

  -- Add payment_2_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_commissions' AND column_name = 'payment_2_date'
  ) THEN
    ALTER TABLE broker_commissions ADD COLUMN payment_2_date date;
  END IF;
END $$;