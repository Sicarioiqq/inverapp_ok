/*
  # Fix date timezone handling

  1. Changes
    - Add function to convert dates to UTC
    - Add function to format dates consistently
    - Ensure dates are stored with proper timezone info
    
  2. Security
    - Maintain existing RLS policies
*/

-- Function to ensure dates are stored with UTC timezone
CREATE OR REPLACE FUNCTION public.ensure_utc_date(date_value date)
RETURNS timestamptz AS $$
BEGIN
  IF date_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Convert date to timestamptz at UTC midnight
  RETURN date_value::timestamptz AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql;

-- Function to format date as DD-MM-YYYY
CREATE OR REPLACE FUNCTION public.format_date_as_dmy(date_value date)
RETURNS text AS $$
BEGIN
  IF date_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN to_char(date_value, 'DD-MM-YYYY');
END;
$$ LANGUAGE plpgsql;

-- Function to parse date from various formats
CREATE OR REPLACE FUNCTION public.parse_date_safely(date_text text)
RETURNS date AS $$
DECLARE
  result_date date;
BEGIN
  -- Handle null or empty input
  IF date_text IS NULL OR date_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Try to parse as ISO date (YYYY-MM-DD)
  BEGIN
    result_date := date_text::date;
    RETURN result_date;
  EXCEPTION WHEN OTHERS THEN
    -- Continue to next format
  END;
  
  -- Try to parse as DD-MM-YYYY
  BEGIN
    result_date := to_date(date_text, 'DD-MM-YYYY');
    RETURN result_date;
  EXCEPTION WHEN OTHERS THEN
    -- Continue to next format
  END;
  
  -- Try to parse as MM/DD/YYYY
  BEGIN
    result_date := to_date(date_text, 'MM/DD/YYYY');
    RETURN result_date;
  EXCEPTION WHEN OTHERS THEN
    -- Return null if all formats fail
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure consistent date handling in reservations
CREATE OR REPLACE FUNCTION public.normalize_reservation_dates()
RETURNS trigger AS $$
BEGIN
  -- Ensure reservation_date is stored as UTC date
  IF NEW.reservation_date IS NOT NULL THEN
    NEW.reservation_date := NEW.reservation_date::date;
  END IF;
  
  -- Ensure promise_date is stored as UTC date
  IF NEW.promise_date IS NOT NULL THEN
    NEW.promise_date := NEW.promise_date::date;
  END IF;
  
  -- Ensure deed_date is stored as UTC date
  IF NEW.deed_date IS NOT NULL THEN
    NEW.deed_date := NEW.deed_date::date;
  END IF;
  
  -- Ensure commission_payment_month is stored as UTC date (first day of month)
  IF NEW.commission_payment_month IS NOT NULL THEN
    -- Extract year and month, then set day to 1
    NEW.commission_payment_month := date_trunc('month', NEW.commission_payment_month::date)::date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for normalizing dates in reservations
DROP TRIGGER IF EXISTS normalize_reservation_dates_trigger ON reservations;
CREATE TRIGGER normalize_reservation_dates_trigger
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_reservation_dates();