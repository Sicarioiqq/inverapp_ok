/*
  # Create stock_unidades table

  1. New Tables
    - `stock_unidades` - Table to store available units for quotation
      - `id` (uuid, primary key)
      - `created_at` (timestamp with time zone)
      - `proyecto_nombre` (text)
      - `unidad` (text)
      - `tipologia` (text)
      - `piso` (text)
      - `orientacion` (text)
      - `etapa` (numeric)
      - `tipo_bien` (text)
      - `valor_lista` (numeric)
      - `descuento` (numeric)
      - `sup_interior` (numeric)
      - `sup_util` (numeric)
      - `sup_terraza` (numeric)
      - `sup_ponderada` (numeric)
      - `sup_terreno` (numeric)
      - `sup_jardin` (numeric)
      - `sup_total` (numeric)
      - `sup_logia` (numeric)
      - `fecha_carga` (timestamp with time zone)
      - `estado_unidad` (text)
  2. Security
    - No RLS policies needed as this is a public read-only table
*/

CREATE TABLE IF NOT EXISTS stock_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  proyecto_nombre text,
  unidad text,
  tipologia text,
  piso text,
  orientacion text,
  etapa numeric,
  tipo_bien text,
  valor_lista numeric,
  descuento numeric,
  sup_interior numeric,
  sup_util numeric,
  sup_terraza numeric,
  sup_ponderada numeric,
  sup_terreno numeric,
  sup_jardin numeric,
  sup_total numeric,
  sup_logia numeric,
  fecha_carga timestamptz NOT NULL DEFAULT now(),
  estado_unidad text NOT NULL DEFAULT 'Disponible'
);

-- Create a unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS stock_unidades_proy_uni_tipo_unique ON stock_unidades (proyecto_nombre, unidad, tipo_bien);

-- Create a check constraint for estado_unidad
ALTER TABLE stock_unidades 
ADD CONSTRAINT stock_unidades_estado_check 
CHECK (estado_unidad IN ('Disponible', 'Reservado', 'Vendido', 'No Disponible'));