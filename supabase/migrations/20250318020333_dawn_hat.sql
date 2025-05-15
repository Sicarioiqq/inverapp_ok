/*
  # Crear tabla de proyectos inmobiliarios

  1. Nueva Tabla
    - `projects`
      - `id` (uuid, primary key)
      - `name` (text) - Nombre del proyecto
      - `stage` (text) - Etapa del proyecto
      - `commune` (text) - Comuna donde se ubica
      - `deadline` (date) - Fecha tope de entrega
      - `installments` (integer) - Número de cuotas
      - `real_estate_agency_id` (uuid) - Referencia a la inmobiliaria
      - Campos de auditoría (created_at, updated_at, created_by, updated_by)

  2. Seguridad
    - Habilitar RLS
    - Políticas para usuarios autenticados
*/

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stage text NOT NULL,
  commune text NOT NULL,
  deadline date NOT NULL,
  installments integer NOT NULL,
  real_estate_agency_id uuid REFERENCES real_estate_agencies(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Crear índices para búsqueda
CREATE INDEX projects_name_idx ON projects (name);
CREATE INDEX projects_deadline_idx ON projects (deadline);

-- Habilitar Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
CREATE POLICY "Usuarios autenticados pueden ver proyectos" ON projects
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear proyectos" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar proyectos" ON projects
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Crear trigger para actualizar el timestamp
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();