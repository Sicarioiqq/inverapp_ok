/*
  # Agregar políticas RLS para user_roles

  1. Cambios
    - Agregar política para permitir inserción en user_roles
    - Mantener políticas existentes de lectura

  2. Seguridad
    - Permitir a usuarios autenticados crear registros en user_roles
    - Mantener la restricción de que solo pueden leer sus propios roles
*/

-- Eliminar política existente si existe
DROP POLICY IF EXISTS "Usuarios pueden crear roles de usuario" ON user_roles;

-- Crear nueva política para permitir inserción
CREATE POLICY "Usuarios pueden crear roles de usuario"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Asegurar que la tabla tiene RLS habilitado
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;