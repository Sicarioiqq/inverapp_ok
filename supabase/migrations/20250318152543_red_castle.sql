/*
  # Corregir campos calculados en tabla de reservas

  1. Cambios
    - Reordenar columnas para mejor organización
    - Corregir cálculos de campos generados
    - Asegurar que los descuentos se apliquen correctamente
    - Mantener campos existentes y sus relaciones

  2. Notas
    - Los campos calculados se actualizan automáticamente
    - Los descuentos se aplican solo al precio del departamento
    - El precio total incluye todos los componentes
*/

-- Recrear la tabla con el orden correcto y los cálculos actualizados
CREATE TABLE new_reservations (
  -- Identificación
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number text UNIQUE NOT NULL,
  reservation_date date NOT NULL,
  
  -- Referencias
  client_id uuid REFERENCES clients(id) NOT NULL,
  project_id uuid REFERENCES projects(id) NOT NULL,
  seller_id uuid REFERENCES auth.users(id),
  
  -- Broker
  is_with_broker boolean DEFAULT false,
  broker_id uuid REFERENCES brokers(id),
  
  -- Unidades
  apartment_number text NOT NULL,
  parking_number text,
  storage_number text,
  
  -- Precios Lista (UF)
  apartment_price numeric NOT NULL DEFAULT 0,
  parking_price numeric NOT NULL DEFAULT 0,
  storage_price numeric NOT NULL DEFAULT 0,
  total_price numeric GENERATED ALWAYS AS (
    apartment_price + parking_price + storage_price
  ) STORED,
  
  -- Descuentos (%)
  column_discount numeric NOT NULL DEFAULT 0,
  additional_discount numeric NOT NULL DEFAULT 0,
  other_discount numeric NOT NULL DEFAULT 0,
  
  -- Precio Final (UF)
  minimum_price numeric GENERATED ALWAYS AS (
    (apartment_price * (1 - column_discount) * (1 - additional_discount) * (1 - other_discount)) +
    parking_price + storage_price
  ) STORED,
  
  -- Forma de Pago (UF)
  reservation_payment numeric NOT NULL DEFAULT 0,
  promise_payment numeric NOT NULL DEFAULT 0,
  down_payment numeric NOT NULL DEFAULT 0,
  credit_payment numeric NOT NULL DEFAULT 0,
  subsidy_payment numeric NOT NULL DEFAULT 0,
  
  -- Totales Calculados (UF)
  total_payment numeric GENERATED ALWAYS AS (
    reservation_payment + promise_payment + down_payment + credit_payment + subsidy_payment
  ) STORED,
  recovery_payment numeric GENERATED ALWAYS AS (
    reservation_payment + promise_payment + down_payment + credit_payment
  ) STORED,
  
  -- Auditoría
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Copiar datos de la tabla existente
INSERT INTO new_reservations (
  id, reservation_number, reservation_date, client_id, project_id, seller_id,
  is_with_broker, broker_id, apartment_number, parking_number, storage_number,
  apartment_price, parking_price, storage_price, column_discount, additional_discount,
  other_discount, reservation_payment, promise_payment, down_payment, credit_payment,
  subsidy_payment, created_at, updated_at, created_by, updated_by
)
SELECT 
  id, reservation_number, reservation_date, client_id, project_id, seller_id,
  is_with_broker, broker_id, apartment_number, parking_number, storage_number,
  apartment_price, parking_price, storage_price, column_discount, additional_discount,
  other_discount, reservation_payment, promise_payment, down_payment, credit_payment,
  subsidy_payment, created_at, updated_at, created_by, updated_by
FROM reservations;

-- Eliminar tabla antigua
DROP TABLE reservations;

-- Renombrar nueva tabla
ALTER TABLE new_reservations RENAME TO reservations;

-- Recrear índices
CREATE INDEX reservations_reservation_number_idx ON reservations (reservation_number);
CREATE INDEX reservations_client_id_idx ON reservations (client_id);
CREATE INDEX reservations_project_id_idx ON reservations (project_id);
CREATE INDEX reservations_reservation_date_idx ON reservations (reservation_date);

-- Habilitar RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Recrear políticas
CREATE POLICY "Usuarios autenticados pueden ver reservas"
  ON reservations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear reservas"
  ON reservations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar reservas"
  ON reservations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Recrear trigger para updated_at
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();