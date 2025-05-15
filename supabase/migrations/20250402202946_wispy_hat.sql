-- Function to convert month name to number
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