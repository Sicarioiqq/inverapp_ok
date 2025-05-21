/*
  # Add unique constraint to stock_unidades table

  1. New Constraints
    - Add a unique constraint on (proyecto_nombre, unidad) columns in the stock_unidades table
      to enable upsert operations with ON CONFLICT
*/

-- Add unique constraint to stock_unidades table
ALTER TABLE IF EXISTS public.stock_unidades 
ADD CONSTRAINT stock_unidades_proyecto_nombre_unidad_key UNIQUE (proyecto_nombre, unidad);