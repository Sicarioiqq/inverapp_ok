/*
  # Corregir función exec_sql para consultas SQL directas
  
  1. Cambios
    - Crear función exec_sql que permite ejecutar consultas SQL directas
    - Devolver resultados como JSON para facilitar su uso en el frontend
    - Implementar con seguridad adecuada
    
  2. Seguridad
    - Función accesible solo para usuarios autenticados
    - Implementa SECURITY DEFINER para ejecutar con privilegios del propietario
*/

-- Crear la función exec_sql
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Ejecutar la consulta y capturar el resultado
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql_query || ') t' INTO result;
  
  -- Devolver el resultado como JSON
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Otorgar permiso de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;