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
    -- Extract just the date part (YYYY-MM-DD)
    NEW.commission_payment_month := (NEW.commission_payment_month::text)::date;
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