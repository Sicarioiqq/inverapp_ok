/*
  # Corregir políticas de almacenamiento para avatares

  1. Cambios
    - Eliminar políticas existentes
    - Crear nuevas políticas que permitan:
      - Administradores gestionar todos los avatares
      - Usuarios gestionar su propio avatar
    - Asegurar que las políticas usen el user_type de profiles
    
  2. Seguridad
    - Mantener acceso público para visualización
    - Restringir operaciones de escritura según rol
*/

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Admins and users can upload avatars" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Admins and users can update avatars" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Admins and users can delete avatars" ON storage.objects CASCADE;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects CASCADE;

-- Crear nuevas políticas
CREATE POLICY "Usuarios y admins pueden subir avatares"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND (
    auth.uid()::text = SPLIT_PART(name, '/', 1)
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'Administrador'
    )
  )
);

CREATE POLICY "Usuarios y admins pueden actualizar avatares"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' AND (
    auth.uid()::text = SPLIT_PART(name, '/', 1)
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'Administrador'
    )
  )
);

CREATE POLICY "Usuarios y admins pueden eliminar avatares"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' AND (
    auth.uid()::text = SPLIT_PART(name, '/', 1)
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type = 'Administrador'
    )
  )
);

CREATE POLICY "Avatares son públicamente accesibles"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

-- Asegurar que el bucket existe y es público
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;