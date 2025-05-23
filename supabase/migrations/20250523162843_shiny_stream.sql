/*
  # Create valores_financieros table

  1. New Tables
    - `valores_financieros`
      - `id` (uuid, primary key)
      - `valor` (numeric, not null) - The value in Chilean pesos
      - `nombre` (text, not null) - Name of the financial value (e.g., 'UF')
      - `fecha` (date, not null) - Date of the value
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `valores_financieros` table
    - Add policy for authenticated users to read values
    - Add policy for admin users to manage values

  3. Indexes
    - Index on (nombre, fecha) for efficient queries
    - Index on fecha for date-based queries

  4. Initial Data
    - Insert current UF value as initial data
*/

-- Create the table
CREATE TABLE IF NOT EXISTS valores_financieros (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    valor numeric NOT NULL,
    nombre text NOT NULL,
    fecha date NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_valores_financieros_nombre_fecha ON valores_financieros (nombre, fecha);
CREATE INDEX IF NOT EXISTS idx_valores_financieros_fecha ON valores_financieros (fecha);

-- Enable RLS
ALTER TABLE valores_financieros ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read valores_financieros"
    ON valores_financieros
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage valores_financieros"
    ON valores_financieros
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.user_type = 'Administrador'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.user_type = 'Administrador'
        )
    );

-- Create trigger for updated_at
CREATE TRIGGER update_valores_financieros_updated_at
    BEFORE UPDATE ON valores_financieros
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Insert initial UF value (using a recent value as example)
INSERT INTO valores_financieros (valor, nombre, fecha)
VALUES (37000.00, 'UF', CURRENT_DATE)
ON CONFLICT DO NOTHING;