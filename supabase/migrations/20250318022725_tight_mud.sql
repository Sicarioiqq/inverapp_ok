/*
  # Create Reservations Schema

  1. New Tables
    - `reservations`
      - `id` (uuid, primary key)
      - `reservation_number` (text, unique) - Número de reserva
      - `client_id` (uuid) - Cliente asociado
      - `project_id` (uuid) - Proyecto asociado
      - `reservation_date` (date) - Fecha de reserva
      - Unit Identification:
        - `apartment_number` (text) - N° Departamento
        - `parking_number` (text) - N° Estacionamiento
        - `storage_number` (text) - N° Bodega
      - List Prices:
        - `apartment_price` (numeric) - Departamento Lista
        - `parking_price` (numeric) - Estacionamiento Lista
        - `storage_price` (numeric) - Bodega Lista
        - `total_price` (numeric) - Total Lista (calculated)
      - Discounts:
        - `column_discount` (numeric) - Dcto. Columna (%)
        - `additional_discount` (numeric) - Dcto. Adicional (%)
        - `other_discount` (numeric) - Dcto. Otros (%)
        - `minimum_price` (numeric) - Precio Mínimo (calculated)
      - Payment Method:
        - `reservation_payment` (numeric) - Reserva
        - `promise_payment` (numeric) - Promesa
        - `down_payment` (numeric) - Pie
        - `credit_payment` (numeric) - Crédito
        - `subsidy_payment` (numeric) - Bono
        - `total_payment` (numeric) - Total (calculated)
        - `recovery_payment` (numeric) - Recuperación (calculated)
      - Audit fields

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id) NOT NULL,
  project_id uuid REFERENCES projects(id) NOT NULL,
  reservation_date date NOT NULL,
  
  -- Unit Identification
  apartment_number text NOT NULL,
  parking_number text,
  storage_number text,
  
  -- List Prices
  apartment_price numeric NOT NULL DEFAULT 0,
  parking_price numeric NOT NULL DEFAULT 0,
  storage_price numeric NOT NULL DEFAULT 0,
  total_price numeric GENERATED ALWAYS AS (
    apartment_price + parking_price + storage_price
  ) STORED,
  
  -- Discounts (stored as decimals between 0 and 1)
  column_discount numeric NOT NULL DEFAULT 0,
  additional_discount numeric NOT NULL DEFAULT 0,
  other_discount numeric NOT NULL DEFAULT 0,
  minimum_price numeric GENERATED ALWAYS AS (
    (apartment_price * (1 - column_discount) * (1 - additional_discount) * (1 - other_discount)) +
    parking_price + storage_price
  ) STORED,
  
  -- Payment Method
  reservation_payment numeric NOT NULL DEFAULT 0,
  promise_payment numeric NOT NULL DEFAULT 0,
  down_payment numeric NOT NULL DEFAULT 0,
  credit_payment numeric NOT NULL DEFAULT 0,
  subsidy_payment numeric NOT NULL DEFAULT 0,
  total_payment numeric GENERATED ALWAYS AS (
    reservation_payment + promise_payment + down_payment + credit_payment + subsidy_payment
  ) STORED,
  recovery_payment numeric GENERATED ALWAYS AS (
    reservation_payment + promise_payment + down_payment + credit_payment
  ) STORED,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX reservations_reservation_number_idx ON reservations (reservation_number);
CREATE INDEX reservations_client_id_idx ON reservations (client_id);
CREATE INDEX reservations_project_id_idx ON reservations (project_id);
CREATE INDEX reservations_reservation_date_idx ON reservations (reservation_date);

-- Enable RLS
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver reservas" ON reservations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear reservas" ON reservations
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar reservas" ON reservations
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();