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

-- Create a cron job to fetch the UF value daily
SELECT cron.schedule(
    'fetch-uf-daily',
    '0 1 * * *',  -- Run at 1:00 AM every day
    $$SELECT fetch_uf_value()$$
);

-- Insert current UF value for testing
INSERT INTO valores_financieros (valor, nombre, fecha)
VALUES (36500.00, 'UF', CURRENT_DATE)
ON CONFLICT (nombre, fecha) DO UPDATE
SET valor = 36500.00;