/*
  # Add commission_projection_month field to reservations table

  1. Changes
    - Add commission_projection_month column to reservations table
    - This field will store the projected month for commission payment
    - Similar to commission_payment_month field
    
  2. Notes
    - Uses date type to store the first day of the month
    - Will be displayed in "month de year" format in the UI
*/

-- Add commission_projection_month column to reservations table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservations' 
    AND column_name = 'commission_projection_month'
  ) THEN
    ALTER TABLE reservations 
    ADD COLUMN commission_projection_month date;
  END IF;
END $$;

-- Update normalize_dates_without_timezone function to handle the new field
CREATE OR REPLACE FUNCTION normalize_dates_without_timezone()
RETURNS trigger AS $$
BEGIN
  -- For reservation_date, ensure it's stored as a date without timezone conversion
  IF NEW.reservation_date IS NOT NULL THEN
    -- Extract just the date part (YYYY-MM-DD) and store it back
    NEW.reservation_date := (NEW.reservation_date::text)::date;
  END IF;
  
  -- For promise_date, ensure it's stored as a date without timezone conversion
  IF NEW.promise_date IS NOT NULL THEN
    -- Extract just the date part (YYYY-MM-DD) and store it back
    NEW.promise_date := (NEW.promise_date::text)::date;
  END IF;
  
  -- For deed_date, ensure it's stored as a date without timezone conversion
  IF NEW.deed_date IS NOT NULL THEN
    -- Extract just the date part (YYYY-MM-DD) and store it back
    NEW.deed_date := (NEW.deed_date::text)::date;
  END IF;
  
  -- For commission_payment_month, ensure it's stored as a date without timezone conversion
  IF NEW.commission_payment_month IS NOT NULL THEN
    -- Extract just the date part (YYYY-MM-DD)
    NEW.commission_payment_month := (NEW.commission_payment_month::text)::date;
  END IF;
  
  -- For commission_projection_month, ensure it's stored as a date without timezone conversion
  IF NEW.commission_projection_month IS NOT NULL THEN
    -- Extract just the date part (YYYY-MM-DD)
    NEW.commission_projection_month := (NEW.commission_projection_month::text)::date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;