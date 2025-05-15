/*
  # Add difference field to broker_commissions table

  1. Changes
    - Add difference column to broker_commissions table
    - This field stores the calculated difference between recovery_payment, minimum_price, and commission_amount
    
  2. Notes
    - The difference is calculated as: recovery_payment - minimum_price - commission_amount
    - This field helps track the financial impact of each broker commission
*/

-- Add difference column to broker_commissions table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broker_commissions' 
    AND column_name = 'difference'
  ) THEN
    ALTER TABLE broker_commissions 
    ADD COLUMN difference numeric;
  END IF;
END $$;

-- Update existing broker_commissions records to calculate the difference
UPDATE broker_commissions bc
SET difference = (
  SELECT r.recovery_payment - r.minimum_price - bc.commission_amount
  FROM reservations r
  WHERE r.id = bc.reservation_id
)
WHERE difference IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_broker_commissions_difference 
ON broker_commissions(difference);