/*
  # Add unique index for stock_unidades table

  1. Changes
    - Add unique index on `proyecto_nombre` and `unidad` columns in `stock_unidades` table
    - This index is required for upsert operations in the stock upload functionality

  2. Impact
    - Enables upsert operations to work correctly when uploading stock data
    - Prevents duplicate entries with the same project name and unit number
*/

-- Create unique index for proyecto_nombre and unidad columns
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'stock_unidades' 
    AND indexname = 'stock_unidades_proyecto_nombre_unidad_key'
  ) THEN
    CREATE UNIQUE INDEX stock_unidades_proyecto_nombre_unidad_key ON stock_unidades (proyecto_nombre, unidad);
  END IF;
END $$;