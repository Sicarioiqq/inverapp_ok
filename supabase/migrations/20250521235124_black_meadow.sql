/*
  # Fix unique constraint for stock_unidades table
  
  1. Changes
     - Safely check for and create unique constraint on stock_unidades table
     - Uses IF NOT EXISTS to avoid errors if constraint already exists
     - Adds proper error handling with DO block
*/

-- Check if constraint exists and create it only if it doesn't
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'stock_unidades_proyecto_nombre_unidad_key'
  ) THEN
    -- Add unique constraint to stock_unidades table if it doesn't exist
    ALTER TABLE IF EXISTS public.stock_unidades 
    ADD CONSTRAINT stock_unidades_proyecto_nombre_unidad_key UNIQUE (proyecto_nombre, unidad);
    
    RAISE NOTICE 'Unique constraint stock_unidades_proyecto_nombre_unidad_key created successfully';
  ELSE
    RAISE NOTICE 'Unique constraint stock_unidades_proyecto_nombre_unidad_key already exists, skipping creation';
  END IF;
END $$;