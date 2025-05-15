/*
  # Fix commission_payment_month format and handling

  1. Changes
    - Add function to convert text month format to date format
    - Add function to format date as month and year text
    - Update existing data to ensure consistent format
    - Maintain text column type for flexibility

  2. Notes
    - Preserves existing data
    - Improves query consistency
    - Maintains backward compatibility
*/

-- Create function to convert month name to date format
CREATE OR REPLACE FUNCTION format_month_year_to_date(month_year_text text)
RETURNS date AS $$
DECLARE
  month_name text;
  year_text text;
  month_number text;
  result_date date;
BEGIN
  -- Check if already in YYYY-MM-DD format
  IF month_year_text ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN month_year_text::date;
  END IF;
  
  -- Check if in YYYY-MM format
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
      result_date := (year_text || '-' || month_number || '-01')::date;
      RETURN result_date;
    END IF;
  END IF;
  
  -- Return NULL if format not recognized
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to format date as month and year text
CREATE OR REPLACE FUNCTION format_date_as_month_year(date_value date)
RETURNS text AS $$
DECLARE
  month_name text;
  year_text text;
BEGIN
  IF date_value IS NULL THEN
    RETURN NULL;
  END IF;
  
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
  END;
  
  year_text := EXTRACT(YEAR FROM date_value)::text;
  
  RETURN month_name || ' de ' || year_text;
END;
$$ LANGUAGE plpgsql;

-- Update existing data to ensure consistent format
UPDATE reservations
SET commission_payment_month = 
  CASE 
    -- If it's already in YYYY-MM-DD format, keep it
    WHEN commission_payment_month ~ '^\d{4}-\d{2}-\d{2}$' THEN 
      commission_payment_month
    -- If it's in YYYY-MM format, add day
    WHEN commission_payment_month ~ '^\d{4}-\d{2}$' THEN 
      commission_payment_month || '-01'
    -- If it's in "month de year" format, convert it
    WHEN commission_payment_month ~ '^(\w+)\s+de\s+(\d{4})$' THEN 
      format_month_year_to_date(commission_payment_month)::text
    -- Otherwise, leave as is
    ELSE commission_payment_month
  END
WHERE commission_payment_month IS NOT NULL;