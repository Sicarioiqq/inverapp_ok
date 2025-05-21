/*
  # Add estado_unidad column to stock_unidades table

  1. Changes
    - Add estado_unidad column to stock_unidades table with default value 'Disponible'
    - Add check constraint to ensure valid status values
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stock_unidades' AND column_name = 'estado_unidad'
  ) THEN
    ALTER TABLE stock_unidades 
    ADD COLUMN estado_unidad text NOT NULL DEFAULT 'Disponible';

    ALTER TABLE stock_unidades 
    ADD CONSTRAINT stock_unidades_estado_check 
    CHECK (estado_unidad IN ('Disponible', 'Reservado', 'Vendido', 'No Disponible'));
  END IF;
END $$;