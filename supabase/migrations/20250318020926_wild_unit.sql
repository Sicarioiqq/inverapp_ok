/*
  # Agregar logo a proyectos

  1. Cambios
    - Agregar columna `logo_url` a la tabla `projects`
    
  2. Notas
    - El logo se almacenará como URL
    - Se permite que sea NULL para proyectos sin logo
*/

ALTER TABLE projects ADD COLUMN logo_url text;