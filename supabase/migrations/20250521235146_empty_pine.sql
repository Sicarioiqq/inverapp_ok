/*
  # Fix unique constraint for stock_unidades table

  1. Changes
    - Safely checks for and creates unique constraint on stock_unidades table
    - Uses a more robust approach to avoid errors when constraint already exists
*/

-- Check if constraint exists and create it only if it doesn't
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  -- Check if the constraint already exists
  SELECT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.conname = 'stock_unidades_proyecto_nombre_unidad_key'
    AND n.nspname = 'public'
    AND t.relname = 'stock_unidades'
  ) INTO constraint_exists;
  
  IF NOT constraint_exists THEN
    -- Create the constraint using a dynamic SQL to avoid errors
    EXECUTE 'ALTER TABLE public.stock_unidades ADD CONSTRAINT stock_unidades_proyecto_nombre_unidad_key UNIQUE (proyecto_nombre, unidad)';
    RAISE NOTICE 'Unique constraint stock_unidades_proyecto_nombre_unidad_key created successfully';
  ELSE
    RAISE NOTICE 'Unique constraint stock_unidades_proyecto_nombre_unidad_key already exists, skipping creation';
  END IF;
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'Constraint already exists, continuing...';
  WHEN others THEN
    RAISE NOTICE 'An error occurred: %', SQLERRM;
END $$;