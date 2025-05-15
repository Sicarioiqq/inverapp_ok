/*
  # Add broker fields to reservations

  1. Changes
    - Add broker-related fields to reservations table:
      - `is_with_broker` (boolean) - Indica si la reserva es con broker
      - `broker_id` (uuid) - Referencia al broker asociado
*/

-- Add broker fields to reservations
DO $$ 
BEGIN
  -- Add is_with_broker column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservations' AND column_name = 'is_with_broker'
  ) THEN
    ALTER TABLE reservations ADD COLUMN is_with_broker boolean DEFAULT false;
  END IF;

  -- Add broker_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservations' AND column_name = 'broker_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN broker_id uuid REFERENCES brokers(id);
  END IF;
END $$;