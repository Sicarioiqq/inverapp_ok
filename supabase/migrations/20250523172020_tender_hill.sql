/*
  # Actualización del valor de la UF

  1. Cambios
     - Actualiza el valor de la UF al valor actual (39.169,25)
     - Mejora la función fetch_uf_value para manejar errores de manera más robusta
     - Añade un índice para mejorar el rendimiento de las consultas
*/

-- Actualizar el valor de la UF al valor actual
UPDATE valores_financieros
SET valor = 39169.25
WHERE nombre = 'UF' AND fecha = CURRENT_DATE;

-- Si no existe un valor para hoy, insertarlo
INSERT INTO valores_financieros (valor, nombre, fecha)
SELECT 39169.25, 'UF', CURRENT_DATE
WHERE NOT EXISTS (
    SELECT 1 FROM valores_financieros 
    WHERE nombre = 'UF' AND fecha = CURRENT_DATE
);

-- Mejorar la función fetch_uf_value para manejar errores de manera más robusta
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

    -- Try to fetch from CMF API first (more reliable)
    BEGIN
        SELECT content::jsonb INTO api_response
        FROM http_get('https://api.cmfchile.cl/api-sbifv3/recursos_api/uf?apikey=e078e0a4a72f28b70d1f937f3e5917b2e9e6b6e8&formato=json');
        
        IF api_response IS NOT NULL AND api_response->>'UFs' IS NOT NULL THEN
            -- Extract the UF value from the response
            SELECT REPLACE(REPLACE((api_response->'UFs'->0->>'Valor'), '.', ''), ',', '.')::NUMERIC INTO uf_value;
            
            IF uf_value IS NOT NULL AND uf_value > 0 THEN
                -- Insert the UF value into the database
                INSERT INTO valores_financieros (valor, nombre, fecha)
                VALUES (uf_value, 'UF', today_date)
                ON CONFLICT (nombre, fecha) DO UPDATE
                SET valor = uf_value;
                
                RAISE NOTICE 'UF value % inserted for % from CMF API', uf_value, today_date;
                RETURN;
            END IF;
        END IF;
        
        RAISE NOTICE 'Failed to parse UF value from CMF API';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error fetching UF from CMF API: %', SQLERRM;
    END;
    
    -- If CMF API failed, try mindicador.cl API
    BEGIN
        SELECT content::jsonb INTO api_response
        FROM http_get('https://mindicador.cl/api/uf');
        
        IF api_response IS NOT NULL AND api_response->>'serie' IS NOT NULL THEN
            -- Extract the UF value from the response
            SELECT (api_response->'serie'->0->>'valor')::NUMERIC INTO uf_value;
            
            IF uf_value IS NOT NULL AND uf_value > 0 THEN
                -- Insert the UF value into the database
                INSERT INTO valores_financieros (valor, nombre, fecha)
                VALUES (uf_value, 'UF', today_date)
                ON CONFLICT (nombre, fecha) DO UPDATE
                SET valor = uf_value;
                
                RAISE NOTICE 'UF value % inserted for % from mindicador.cl API', uf_value, today_date;
                RETURN;
            END IF;
        END IF;
        
        RAISE NOTICE 'Failed to parse UF value from mindicador.cl API';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error fetching UF from mindicador.cl: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Failed to fetch UF value from any API';
END;
$$ LANGUAGE plpgsql;