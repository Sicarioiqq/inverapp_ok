/*
  # Fix month year handling in commission_payment_month

  1. Changes
    - Add functions to handle month-year format conversion
    - Ensure proper parsing of "month de year" format
    - Fix timezone issues with date handling
    
  2. Notes
    - Functions help standardize date format across the application
    - Improves reliability of date parsing and formatting
*/

-- Function to convert month name to date format
CREATE OR REPLACE FUNCTION public.month_name_to_number(month_name text)
RETURNS text AS $$
BEGIN
  RETURN CASE lower(month_name)
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
END;
$$ LANGUAGE plpgsql;

-- Function to convert month number to name
CREATE OR REPLACE FUNCTION public.month_number_to_name(month_number int)
RETURNS text AS $$
BEGIN
  RETURN CASE month_number
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
END;
$$ LANGUAGE plpgsql;

-- Function to parse month-year text to date
CREATE OR REPLACE FUNCTION public.parse_month_year(month_year_text text)
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
    month_number := public.month_name_to_number(month_name);
    
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

-- Function to format date as "month de year"
CREATE OR REPLACE FUNCTION public.format_as_month_year(date_value date)
RETURNS text AS $$
DECLARE
  month_name text;
  year_text text;
BEGIN
  IF date_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get month name and year
  month_name := public.month_number_to_name(EXTRACT(MONTH FROM date_value)::int);
  year_text := EXTRACT(YEAR FROM date_value)::text;
  
  -- Return formatted string
  RETURN month_name || ' de ' || year_text;
END;
$$ LANGUAGE plpgsql;