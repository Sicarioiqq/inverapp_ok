/*
  # Crear tabla de clientes y sus relaciones

  1. Nueva Tabla
    - `clients`
      - `id` (uuid, primary key)
      - `rut` (text, unique) - Identificador único del cliente
      - `first_name` (text) - Nombres del cliente
      - `last_name` (text) - Apellidos del cliente
      - `birth_date` (date) - Fecha de nacimiento
      - `phone` (text) - Teléfono de contacto
      - `email` (text) - Correo electrónico
      - `created_at` (timestamptz) - Fecha de creación
      - `updated_at` (timestamptz) - Fecha de última actualización
      - `created_by` (uuid) - Usuario que creó el registro
      - `updated_by` (uuid) - Usuario que actualizó el registro

  2. Índices
    - Índice único en `rut`
    - Índice de búsqueda en `first_name`, `last_name`
    - Índice en `email`

  3. Seguridad
    - Habilitar RLS
    - Políticas para:
      - Lectura: usuarios autenticados pueden ver todos los clientes
      - Creación: usuarios autenticados pueden crear clientes
      - Actualización: usuarios autenticados pueden actualizar clientes
      - Eliminación: usuarios autenticados pueden eliminar clientes (soft delete)
*/

-- Crear la tabla de clientes
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rut text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date NOT NULL,
  phone text,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz DEFAULT null
);

-- Crear índices para búsqueda
CREATE INDEX clients_names_idx ON clients (first_name, last_name);
CREATE INDEX clients_email_idx ON clients (email);

-- Habilitar Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
CREATE POLICY "Usuarios autenticados pueden ver clientes" ON clients
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "Usuarios autenticados pueden crear clientes" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar clientes" ON clients
  FOR UPDATE TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar clientes" ON clients
  FOR DELETE TO authenticated
  USING (deleted_at IS NULL);

-- Crear función para actualizar el timestamp de última modificación
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar el timestamp
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();