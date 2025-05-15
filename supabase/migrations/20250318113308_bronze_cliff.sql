/*
  # Corrección de esquema de perfiles y políticas

  1. Cambios
    - Asegurar que los campos requeridos no sean nulos
    - Actualizar políticas de seguridad
    - Establecer valores por defecto apropiados

  2. Seguridad
    - Reforzar políticas RLS para perfiles
    - Asegurar que los usuarios solo puedan ver y modificar su propio perfil
*/

-- Primero establecemos los valores por defecto
ALTER TABLE profiles ALTER COLUMN is_seller SET DEFAULT false;

-- Luego establecemos las restricciones NOT NULL
ALTER TABLE profiles 
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN user_type SET NOT NULL,
  ALTER COLUMN is_seller SET NOT NULL;

-- Actualizar políticas existentes
DROP POLICY IF EXISTS "Users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Usuarios pueden crear su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Usuarios pueden leer todos los perfiles" ON profiles;
DROP POLICY IF EXISTS "Usuarios pueden ver vendedores" ON profiles;

-- Crear nuevas políticas
CREATE POLICY "Usuarios autenticados pueden ver todos los perfiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuarios pueden crear su propio perfil"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();