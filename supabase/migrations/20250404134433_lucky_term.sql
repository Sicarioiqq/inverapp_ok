/*
  # Fix date timezone issues

  1. Changes
    - Create a function to normalize dates without timezone conversion
    - Add trigger to ensure dates are stored consistently
    - Update existing date handling functions
    
  2. Notes
    - Prevents dates from being shifted due to timezone differences
    - Ensures dates are stored and retrieved consistently
*/

-- Create a function to normalize dates without timezone conversion
CREATE OR REPLACE FUNCTION normalize_dates_without_timezone()
RETURNS trigger AS $$
DECLARE
  date_fields text[] := ARRAY['reservation_date', 'promise_date', 'deed_date', 'commission_payment_month'];
  field_name text;
BEGIN
  -- Loop through all date fields
  FOREACH field_name IN ARRAY date_fields
  LOOP
    -- If the field exists and has a value
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.reservation_date IS NOT NULL) THEN
      -- For reservation_date, ensure it's stored as a date without timezone conversion
      IF field_name = 'reservation_date' AND NEW.reservation_date IS NOT NULL THEN
        -- Extract just the date part (YYYY-MM-DD) and store it back
        NEW.reservation_date := (NEW.reservation_date::text)::date;
      END IF;
      
      -- For promise_date, ensure it's stored as a date without timezone conversion
      IF field_name = 'promise_date' AND NEW.promise_date IS NOT NULL THEN
        -- Extract just the date part (YYYY-MM-DD) and store it back
        NEW.promise_date := (NEW.promise_date::text)::date;
      END IF;
      
      -- For deed_date, ensure it's stored as a date without timezone conversion
      IF field_name = 'deed_date' AND NEW.deed_date IS NOT NULL THEN
        -- Extract just the date part (YYYY-MM-DD) and store it back
        NEW.deed_date := (NEW.deed_date::text)::date;
      END IF;
      
      -- For commission_payment_month, ensure it's stored as a date without timezone conversion
      IF field_name = 'commission_payment_month' AND NEW.commission_payment_month IS NOT NULL THEN
        -- Extract just the date part (YYYY-MM-DD) and store it back
        NEW.commission_payment_month := (NEW.commission_payment_month::text)::date;
      END IF;
    END IF;
  END LOOP;
  
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

-- Update existing normalize_reservation_dates function to handle dates properly
CREATE OR REPLACE FUNCTION normalize_reservation_dates()
RETURNS trigger AS $$
BEGIN
  -- Ensure reservation_date is stored as date without timezone conversion
  IF NEW.reservation_date IS NOT NULL THEN
    -- Extract just the date part (YYYY-MM-DD)
    NEW.reservation_date := (NEW.reservation_date::text)::date;
  END IF;
  
  -- Ensure promise_date is stored as date without timezone conversion
  IF NEW.promise_date IS NOT NULL THEN
    -- Extract just the date part (YYYY-MM-DD)
    NEW.promise_date := (NEW.promise_date::text)::date;
  END IF;
  
  -- Ensure deed_date is stored as date without timezone conversion
  IF NEW.deed_date IS NOT NULL THEN
    -- Extract just the date part (YYYY-MM-DD)
    NEW.deed_date := (NEW.deed_date::text)::date;
  END IF;
  
  -- Ensure commission_payment_month is stored as date without timezone conversion
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

-- Create a function to parse month-year text to date without timezone issues
CREATE OR REPLACE FUNCTION parse_month_year_without_timezone(month_year_text text)
RETURNS date AS $$
DECLARE
  month_name text;
  year_text text;
  month_number text;
  result_date date;
BEGIN
  -- Handle null or empty input
  IF month_year_text IS NULL OR month_year_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- If already in YYYY-MM-DD format
  IF month_year_text ~ '^\d{4}-\d{2}-\d{2}' THEN
    RETURN month_year_text::date;
  END IF;
  
  -- If in YYYY-MM format
  IF month_year_text ~ '^\d{4}-\d{2}$' THEN
    RETURN (month_year_text || '-01')::date;
  END IF;
  
  -- Try to parse "month de year" format
  IF month_year_text ~ '^(\w+)\s+de\s+(\d{4})$' THEN
    month_name := lower(substring(month_year_text from '^(\w+)\s+de\s+(\d{4})$' for '#1'));
    year_text := substring(month_year_text from '^(\w+)\s+de\s+(\d{4})$' for '#2');
    
    -- Convert month name to number
    month_number := CASE month_name
      WHEN 'enero' THEN '01'
      WHEN 'febrero' THEN '02'
      WHEN 'marzo' THEN '03'
      WHEN 'abril' THEN '04'
      WHEN 'mayo' THEN '05'
      WHEN 'junio' THEN '06'
      WHEN 'julio' THEN '07'
      WHEN 'agosto' THEN '08'
      WHEN 'septiembre' THEN '09'
      WHEN 'octubre' THEN '10'
      WHEN 'noviembre' THEN '11'
      WHEN 'diciembre' THEN '12'
      ELSE NULL
    END;
    
    IF month_number IS NOT NULL THEN
      -- Create date with first day of month
      result_date := (year_text || '-' || month_number || '-01')::date;
      RETURN result_date;
    END IF;
  END IF;
  
  -- Return NULL if format not recognized
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a function to format date as month-year text
CREATE OR REPLACE FUNCTION format_date_as_month_year_without_timezone(date_value date)
RETURNS text AS $$
DECLARE
  month_name text;
  year_text text;
BEGIN
  IF date_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Extract month and year directly from the date
  month_name := CASE EXTRACT(MONTH FROM date_value)
    WHEN 1 THEN 'enero'
    WHEN 2 THEN 'febrero'
    WHEN 3 THEN 'marzo'
    WHEN 4 THEN 'abril'
    WHEN 5 THEN 'mayo'
    WHEN 6 THEN 'junio'
    WHEN 7 THEN 'julio'
    WHEN 8 THEN 'agosto'
    WHEN 9 THEN 'septiembre'
    WHEN 10 THEN 'octubre'
    WHEN 11 THEN 'noviembre'
    WHEN 12 THEN 'diciembre'
    ELSE NULL
  END;
  
  year_text := EXTRACT(YEAR FROM date_value)::text;
  
  -- Return formatted string
  RETURN month_name || ' de ' || year_text;
END;
$$ LANGUAGE plpgsql;