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

-- Create a function to parse month-year text to date
CREATE OR REPLACE FUNCTION parse_month_year_text(month_year_text text)
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
    IF month_name = 'enero' THEN
      month_number := '01';
    ELSIF month_name = 'febrero' THEN
      month_number := '02';
    ELSIF month_name = 'marzo' THEN
      month_number := '03';
    ELSIF month_name = 'abril' THEN
      month_number := '04';
    ELSIF month_name = 'mayo' THEN
      month_number := '05';
    ELSIF month_name = 'junio' THEN
      month_number := '06';
    ELSIF month_name = 'julio' THEN
      month_number := '07';
    ELSIF month_name = 'agosto' THEN
      month_number := '08';
    ELSIF month_name = 'septiembre' THEN
      month_number := '09';
    ELSIF month_name = 'octubre' THEN
      month_number := '10';
    ELSIF month_name = 'noviembre' THEN
      month_number := '11';
    ELSIF month_name = 'diciembre' THEN
      month_number := '12';
    ELSE
      month_number := NULL;
    END IF;
    
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
CREATE OR REPLACE FUNCTION format_date_as_month_year(date_value date)
RETURNS text AS $$
DECLARE
  month_name text;
  year_text text;
  month_number integer;
BEGIN
  IF date_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Extract month and year directly from the date
  month_number := EXTRACT(MONTH FROM date_value)::integer;
  year_text := EXTRACT(YEAR FROM date_value)::text;
  
  -- Convert month number to name
  IF month_number = 1 THEN
    month_name := 'enero';
  ELSIF month_number = 2 THEN
    month_name := 'febrero';
  ELSIF month_number = 3 THEN
    month_name := 'marzo';
  ELSIF month_number = 4 THEN
    month_name := 'abril';
  ELSIF month_number = 5 THEN
    month_name := 'mayo';
  ELSIF month_number = 6 THEN
    month_name := 'junio';
  ELSIF month_number = 7 THEN
    month_name := 'julio';
  ELSIF month_number = 8 THEN
    month_name := 'agosto';
  ELSIF month_number = 9 THEN
    month_name := 'septiembre';
  ELSIF month_number = 10 THEN
    month_name := 'octubre';
  ELSIF month_number = 11 THEN
    month_name := 'noviembre';
  ELSIF month_number = 12 THEN
    month_name := 'diciembre';
  ELSE
    month_name := '';
  END IF;
  
  -- Return formatted string
  RETURN month_name || ' de ' || year_text;
END;
$$ LANGUAGE plpgsql;

-- Update existing commission_payment_month values to ensure consistent format
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, commission_payment_month FROM reservations WHERE commission_payment_month IS NOT NULL
  LOOP
    -- Try to convert the value to a proper date
    BEGIN
      IF r.commission_payment_month::text ~ '^\d{4}-\d{2}-\d{2}$' THEN
        -- Already in YYYY-MM-DD format, do nothing
        NULL;
      ELSIF r.commission_payment_month::text ~ '^\d{4}-\d{2}$' THEN
        -- In YYYY-MM format, add day
        UPDATE reservations SET commission_payment_month = (r.commission_payment_month::text || '-01')::date WHERE id = r.id;
      ELSIF r.commission_payment_month::text ~ '^(\w+)\s+de\s+(\d{4})$' THEN
        -- In "month de year" format, parse it
        UPDATE reservations SET commission_payment_month = parse_month_year_text(r.commission_payment_month::text) WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If there's an error, log it but continue processing
      RAISE NOTICE 'Error processing commission_payment_month for id %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;