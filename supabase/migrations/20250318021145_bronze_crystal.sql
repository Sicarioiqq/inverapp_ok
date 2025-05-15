/*
  # Crear bucket de almacenamiento para logos de proyectos

  1. Cambios
    - Crear bucket 'project-logos' para almacenar los logos de los proyectos
    - Habilitar acceso público al bucket
    - Establecer políticas de seguridad para el bucket

  2. Seguridad
    - Permitir a usuarios autenticados subir archivos
    - Permitir lectura pública de los archivos
*/

-- Crear el bucket para logos de proyectos
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-logos', 'project-logos', true);

-- Política para permitir a usuarios autenticados subir archivos
CREATE POLICY "Usuarios autenticados pueden subir logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-logos');

-- Política para permitir a usuarios autenticados actualizar sus archivos
CREATE POLICY "Usuarios autenticados pueden actualizar logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-logos');

-- Política para permitir lectura pública de los archivos
CREATE POLICY "Lectura pública de logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'project-logos');