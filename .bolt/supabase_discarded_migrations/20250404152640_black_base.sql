/*
  # Fix commission_payment_month date handling

  1. Changes
    - Create a function to normalize dates without timezone conversion
    - Create a trigger to ensure dates are stored consistently
    - Update existing commission_payment_month values to ensure consistent format
    
  2. Notes
    - Improves reliability of date filtering
    - Maintains backward compatibility
*/

-- Create a function to normalize dates without timezone conversion
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
    -- Extract just the date part (YYYY-MM-DD) and store it back
    NEW.commission_payment_month := (NEW.commission_payment_month::text)::date;
    
    -- If it's a month-year format (YYYY-MM), add day 01
    IF NEW.commission_payment_month::text ~ '^\d{4}-\d{2}$' THEN
      NEW.commission_payment_month := (NEW.commission_payment_month::text || '-01')::date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS normalize_reservation_dates_trigger ON reservations;

-- Create trigger to normalize dates on insert and update
CREATE TRIGGER normalize_reservation_dates_trigger
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION normalize_dates_without_timezone();

-- Update existing commission_payment_month values to ensure consistent format
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, commission_payment_month FROM reservations WHERE commission_payment_month IS NOT NULL
  LOOP
    -- For each record with a commission_payment_month value
    UPDATE reservations
    SET commission_payment_month = 
      CASE 
        -- If it's already a date with day part, keep it
        WHEN commission_payment_month::text ~ '^\d{4}-\d{2}-\d{2}' THEN 
          commission_payment_month
        -- If it's a date without day part (YYYY-MM), add day 01
        WHEN commission_payment_month::text ~ '^\d{4}-\d{2}$' THEN 
          (commission_payment_month::text || '-01')::date
        -- Otherwise, keep as is
        ELSE 
          commission_payment_month
      END
    WHERE id = r.id;
  END LOOP;
END $$;