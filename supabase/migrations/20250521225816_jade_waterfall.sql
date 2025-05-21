/*
  # Add m2_terraza column to stock_unidades table

  1. Changes
    - Add `m2_terraza` column to `stock_unidades` table with numeric type
    - Add `m2_utiles` column to `stock_unidades` table with numeric type
    - Add `m2_totales` column to `stock_unidades` table with numeric type
    - Add `precio_uf` column to `stock_unidades` table with numeric type
    - Add `unidad_codigo` column to `stock_unidades` table with text type
    - Add unique constraint on proyecto_nombre and unidad_codigo

  2. Reason
    - These columns are required for the stock upload functionality
    - The unique constraint ensures we don't have duplicate units for the same project
*/

-- Add new columns for unit measurements and pricing
ALTER TABLE stock_unidades 
ADD COLUMN IF NOT EXISTS m2_terraza numeric,
ADD COLUMN IF NOT EXISTS m2_utiles numeric,
ADD COLUMN IF NOT EXISTS m2_totales numeric,
ADD COLUMN IF NOT EXISTS precio_uf numeric,
ADD COLUMN IF NOT EXISTS unidad_codigo text;

-- Add unique constraint for proyecto_nombre and unidad_codigo
ALTER TABLE stock_unidades
ADD CONSTRAINT stock_unidades_proyecto_nombre_unidad_codigo_key 
UNIQUE (proyecto_nombre, unidad_codigo);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_unidades_proyecto_nombre_unidad_codigo 
ON stock_unidades(proyecto_nombre, unidad_codigo);

CREATE INDEX IF NOT EXISTS idx_stock_unidades_unidad_codigo 
ON stock_unidades(unidad_codigo);