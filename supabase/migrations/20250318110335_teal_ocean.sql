/*
  # Actualización del esquema para gestión de usuarios

  1. Nuevos Campos
    - Agregar campos a la tabla `profiles`:
      - `last_name` (text) - Apellido del usuario
      - `position` (text) - Cargo del usuario
      - `is_seller` (boolean) - Indica si es vendedor
      - `user_type` (text) - Tipo de usuario

  2. Cambios
    - Renombrar `full_name` a `first_name` en `profiles`
    - Agregar campo `seller_id` en `reservations`

  3. Seguridad
    - Mantener políticas RLS existentes
    - Actualizar políticas para nuevos campos
*/

-- Modificar la tabla profiles
ALTER TABLE profiles
  DROP COLUMN full_name,
  ADD COLUMN first_name text,
  ADD COLUMN last_name text,
  ADD COLUMN position text,
  ADD COLUMN is_seller boolean DEFAULT false,
  ADD COLUMN user_type text CHECK (user_type IN ('Administrador', 'KAM', 'Gestor de Pagos', 'Supervisor'));

-- Agregar campo de vendedor a reservations
ALTER TABLE reservations
  ADD COLUMN seller_id uuid REFERENCES auth.users(id);

-- Actualizar políticas existentes
CREATE POLICY "Usuarios pueden ver vendedores"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_seller = true);