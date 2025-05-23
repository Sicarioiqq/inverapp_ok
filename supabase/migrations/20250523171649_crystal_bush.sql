/*
  # UF Value Management

  1. New Functions
     - `fetch_uf_value()`: Function to fetch the latest UF value from external APIs
  
  2. Data
     - Inserts a test UF value for the current date
     
  3. Notes
     - Adds a unique constraint on (nombre, fecha) to support the ON CONFLICT clause
*/

-- First, add a unique constraint to the valores_financieros table for nombre and fecha
DO $$ 
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valores_financieros_nombre_fecha_key'
  ) THEN
    -- Add the constraint if it doesn't exist
    ALTER TABLE valores_financieros 
    ADD CONSTRAINT valores_financieros_nombre_fecha_key 
    UNIQUE (nombre, fecha);
  END IF;
END $$;

-- Create a function to fetch the latest UF value from an external API
CREATE OR REPLACE FUNCTION fetch_uf_value()
RETURNS VOID AS $$
DECLARE
    today_date DATE := CURRENT_DATE;
    api_response JSONB;
    uf_value NUMERIC;
    response_text TEXT;
BEGIN
    -- Check if we already have a value for today
    IF EXISTS (
        SELECT 1 FROM valores_financieros 
        WHERE nombre = 'UF' AND fecha = today_date
    ) THEN
        RAISE NOTICE 'UF value for today already exists';
        RETURN;
    END IF;

    -- Try to fetch from mindicador.cl API
    BEGIN
        SELECT content::jsonb INTO api_response
        FROM http_get('https://mindicador.cl/api/uf');
        
        IF api_response IS NOT NULL AND api_response->>'serie' IS NOT NULL THEN
            -- Extract the UF value from the response
            SELECT (api_response->'serie'->0->>'valor')::NUMERIC INTO uf_value;
            
            IF uf_value IS NOT NULL THEN
                -- Insert the UF value into the database
                INSERT INTO valores_financieros (valor, nombre, fecha)
                VALUES (uf_value, 'UF', today_date);
                
                RAISE NOTICE 'UF value % inserted for %', uf_value, today_date;
                RETURN;
            END IF;
        END IF;
        
        RAISE NOTICE 'Failed to parse UF value from mindicador.cl API';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error fetching UF from mindicador.cl: %', SQLERRM;
    END;
    
    -- If we get here, the first API failed, try a backup API
    BEGIN
        SELECT content::jsonb INTO api_response
        FROM http_get('https://api.cmfchile.cl/api-sbifv3/recursos_api/uf?apikey=e078e0a4a72f28b70d1f937f3e5917b2e9e6b6e8&formato=json');
        
        IF api_response IS NOT NULL AND api_response->>'UFs' IS NOT NULL THEN
            -- Extract the UF value from the response
            SELECT REPLACE(REPLACE((api_response->'UFs'->0->>'Valor'), '.', ''), ',', '.')::NUMERIC INTO uf_value;
            
            IF uf_value IS NOT NULL THEN
                -- Insert the UF value into the database
                INSERT INTO valores_financieros (valor, nombre, fecha)
                VALUES (uf_value, 'UF', today_date);
                
                RAISE NOTICE 'UF value % inserted for % from backup API', uf_value, today_date;
                RETURN;
            END IF;
        END IF;
        
        RAISE NOTICE 'Failed to parse UF value from backup API';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error fetching UF from backup API: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Failed to fetch UF value from any API';
END;
$$ LANGUAGE plpgsql;

-- Note: We're removing the cron.schedule call since the cron schema doesn't exist
-- You'll need to set up a scheduled function in Supabase Edge Functions or use another method
-- to periodically call the fetch_uf_value() function

-- Insert current UF value for testing
INSERT INTO valores_financieros (valor, nombre, fecha)
VALUES (36500.00, 'UF', CURRENT_DATE)
ON CONFLICT (nombre, fecha) DO UPDATE
SET valor = 36500.00;

-- Create a comment to remind about setting up a scheduled task
COMMENT ON FUNCTION fetch_uf_value() IS 'This function should be called daily to update the UF value. Set up a scheduled task in Supabase Edge Functions or another service to call this function.';