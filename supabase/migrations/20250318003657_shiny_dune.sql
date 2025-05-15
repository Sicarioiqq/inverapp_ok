/*
  # Corrección de políticas RLS para perfiles

  1. Cambios
    - Agregar política para permitir la inserción de perfiles
    - Mantener las políticas existentes de lectura y actualización

  2. Seguridad
    - La nueva política permite a usuarios autenticados crear su propio perfil
    - Se mantiene la restricción de que solo pueden crear su propio perfil
*/

-- Eliminar política existente de inserción si existe
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Usuarios pueden crear su propio perfil" ON profiles;
END $$;

-- Crear nueva política de inserción
CREATE POLICY "Usuarios pueden crear su propio perfil"
  ON profiles FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = id);