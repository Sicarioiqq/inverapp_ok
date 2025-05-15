/*
  # Create Operations Schema

  1. New Table
    - `operations`
      - `id` (uuid, primary key)
      - `reservation_id` (uuid) - Reference to reservation
      - `bank` (text) - Banco
      - `executive` (text) - Ejecutivo
      - `executive_email` (text) - Correo Ejecutivo
      - `executive_phone` (text) - Teléfono Ejecutivo
      - `approval_amount` (numeric) - Monto Aprobación
      - `credit_amount` (numeric) - Monto Crédito
      - `status` (text) - Estado (Crédito Rechazado, Tasación más baja, DPS Pendiente)
      - Audit fields

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create operations table
CREATE TABLE operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE NOT NULL,
  bank text NOT NULL,
  executive text NOT NULL,
  executive_email text,
  executive_phone text,
  approval_amount numeric DEFAULT 0,
  credit_amount numeric DEFAULT 0,
  status text CHECK (status IN ('Crédito Rechazado', 'Tasación más baja', 'DPS Pendiente')),
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(reservation_id)
);

-- Create indexes
CREATE INDEX operations_reservation_id_idx ON operations(reservation_id);
CREATE INDEX operations_bank_idx ON operations(bank);
CREATE INDEX operations_status_idx ON operations(status);

-- Enable RLS
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver operaciones"
  ON operations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios de operaciones y admins pueden gestionar operaciones"
  ON operations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (user_type = 'Administrador' OR user_type = 'Operaciones')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (user_type = 'Administrador' OR user_type = 'Operaciones')
    )
  );

-- Create trigger for updating updated_at
CREATE TRIGGER update_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create comments table for operations
CREATE TABLE operation_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid REFERENCES operations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for comments
CREATE INDEX operation_comments_operation_id_idx ON operation_comments(operation_id);
CREATE INDEX operation_comments_user_id_idx ON operation_comments(user_id);

-- Enable RLS
ALTER TABLE operation_comments ENABLE ROW LEVEL SECURITY;

-- Create policies for comments
CREATE POLICY "Usuarios autenticados pueden ver comentarios de operaciones"
  ON operation_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear comentarios de operaciones"
  ON operation_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios de operaciones y admins pueden gestionar comentarios"
  ON operation_comments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (user_type = 'Administrador' OR user_type = 'Operaciones')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (user_type = 'Administrador' OR user_type = 'Operaciones')
    )
  );

-- Create trigger for updating updated_at
CREATE TRIGGER update_operation_comments_updated_at
  BEFORE UPDATE ON operation_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();