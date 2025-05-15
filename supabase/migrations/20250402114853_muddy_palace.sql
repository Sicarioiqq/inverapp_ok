/*
  # Cambiar commission_payment_month de text a date

  1. Cambios
    - Crear función format_month_year_to_date para convertir diferentes formatos a date
    - Normalizar datos existentes en la columna commission_payment_month
    - Cambiar el tipo de columna de text a date
    - Crear función format_date_as_month_year para mostrar fechas en formato "mes de año"

  2. Notas
    - Se manejan múltiples formatos de entrada: YYYY-MM-DD, YYYY-MM, "mes de año"
    - Se convierten cadenas vacías a NULL
    - Se mantiene la integridad de los datos existentes
*/

-- Crear función para convertir texto a fecha
CREATE OR REPLACE FUNCTION format_month_year_to_date(month_year_text text)
RETURNS date AS $$
DECLARE
  month_name text;
  year_text text;
  month_number text;
  result_date date;
BEGIN
  -- Si es NULL o cadena vacía, retornar NULL
  IF month_year_text IS NULL OR month_year_text = '' THEN
    RETURN NULL;
  END IF;
  
  -- Si ya está en formato YYYY-MM-DD, retornar como date
  IF month_year_text ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN month_year_text::date;
  END IF;
  
  -- Si está en formato YYYY-MM, agregar -01 y retornar como date
  IF month_year_text ~ '^\d{4}-\d{2}$' THEN
    RETURN (month_year_text || '-01')::date;
  END IF;
  
  -- Intentar parsear formato "mes de año"
  IF month_year_text ~ '^(\w+)\s+de\s+(\d{4})$' THEN
    month_name := lower(substring(month_year_text from '^(\w+)\s+de\s+(\d{4})$' for '#1'));
    year_text := substring(month_year_text from '^(\w+)\s+de\s+(\d{4})$' for '#2');
    
    -- Convertir nombre del mes a número
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
  
  -- Si no se reconoce el formato, retornar NULL
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Crear función para formatear fecha como "mes de año"
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

-- Normalizar datos existentes en la columna commission_payment_month
UPDATE reservations
SET commission_payment_month = 
  CASE 
    -- Si es NULL, mantener NULL
    WHEN commission_payment_month IS NULL THEN 
      NULL
    -- Si es cadena vacía, asignar NULL
    WHEN commission_payment_month = '' THEN 
      NULL
    -- En cualquier otro caso, intentar convertir usando la función
    ELSE 
      format_month_year_to_date(commission_payment_month)::text
  END;

-- Cambiar el tipo de columna de text a date
ALTER TABLE reservations 
  ALTER COLUMN commission_payment_month TYPE date 
  USING format_month_year_to_date(commission_payment_month);