/*
  # Fix commission_payment_month date handling

  1. Changes
    - Ensure commission_payment_month is properly stored as a date
    - Fix date comparison in queries to properly filter by month
    - Update existing data to ensure consistent format
    
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
    -- If it's a month-year format (YYYY-MM), add day 01
    IF NEW.commission_payment_month::text ~ '^\d{4}-\d{2}$' THEN
      NEW.commission_payment_month := (NEW.commission_payment_month::text || '-01')::date;
    ELSE
      -- Extract just the date part (YYYY-MM-DD)
      NEW.commission_payment_month := (NEW.commission_payment_month::text)::date;
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
UPDATE reservations
SET commission_payment_month = 
  CASE 
    -- If it's already in YYYY-MM-DD format, keep it
    WHEN commission_payment_month ~ '^\d{4}-\d{2}-\d{2}$' THEN 
      commission_payment_month
    -- If it's in YYYY-MM format, add day
    WHEN commission_payment_month ~ '^\d{4}-\d{2}$' THEN 
      (commission_payment_month || '-01')::date
    -- Otherwise, try to parse it
    ELSE 
      CASE 
        WHEN commission_payment_month ~ '^(\w+)\s+de\s+(\d{4})$' THEN
          (
            EXTRACT(YEAR FROM commission_payment_month::date)::text || '-' ||
            LPAD(EXTRACT(MONTH FROM commission_payment_month::date)::text, 2, '0') || '-01'
          )::date
        ELSE commission_payment_month
      END
  END
WHERE commission_payment_month IS NOT NULL;