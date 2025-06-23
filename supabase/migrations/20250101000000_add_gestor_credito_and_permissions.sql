/*
  # Agregar Gestor de Crédito y sistema de permisos

  1. Cambios
    - Agregar 'Gestor de Crédito' al constraint de user_type en profiles
    - Crear tabla user_type_permissions para gestionar permisos
    - Crear tabla permissions para definir permisos del sistema
    - Insertar permisos por defecto
    
  2. Seguridad
    - Habilitar RLS en las nuevas tablas
    - Crear políticas de acceso apropiadas
*/

-- Actualizar constraint de user_type para incluir Gestor de Crédito
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type IN ('Administrador', 'KAM', 'Gestor de Pagos', 'Supervisor', 'Operaciones', 'Gestor de Crédito'));

-- Crear tabla de permisos
CREATE TABLE IF NOT EXISTS permissions (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de relación tipo de usuario - permisos
CREATE TABLE IF NOT EXISTS user_type_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL,
  permission_id text REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
  granted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_type, permission_id)
);

-- Habilitar RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_type_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas para permissions
CREATE POLICY "Usuarios autenticados pueden ver permisos"
  ON permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo administradores pueden gestionar permisos"
  ON permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  );

-- Políticas para user_type_permissions
CREATE POLICY "Usuarios autenticados pueden ver permisos de tipos de usuario"
  ON user_type_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo administradores pueden gestionar permisos de tipos de usuario"
  ON user_type_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    )
  );

-- Insertar permisos del sistema
INSERT INTO permissions (id, name, description, category) VALUES
-- Gestión de Usuarios
('users_view', 'Ver Usuarios', 'Ver lista de usuarios del sistema', 'Usuarios'),
('users_create', 'Crear Usuarios', 'Crear nuevos usuarios', 'Usuarios'),
('users_edit', 'Editar Usuarios', 'Modificar información de usuarios', 'Usuarios'),
('users_delete', 'Eliminar Usuarios', 'Eliminar usuarios del sistema', 'Usuarios'),

-- Gestión de Proyectos
('projects_view', 'Ver Proyectos', 'Ver lista de proyectos', 'Proyectos'),
('projects_create', 'Crear Proyectos', 'Crear nuevos proyectos', 'Proyectos'),
('projects_edit', 'Editar Proyectos', 'Modificar información de proyectos', 'Proyectos'),
('projects_delete', 'Eliminar Proyectos', 'Eliminar proyectos', 'Proyectos'),

-- Gestión de Clientes
('clients_view', 'Ver Clientes', 'Ver lista de clientes', 'Clientes'),
('clients_create', 'Crear Clientes', 'Crear nuevos clientes', 'Clientes'),
('clients_edit', 'Editar Clientes', 'Modificar información de clientes', 'Clientes'),
('clients_delete', 'Eliminar Clientes', 'Eliminar clientes', 'Clientes'),

-- Gestión de Reservas
('reservations_view', 'Ver Reservas', 'Ver lista de reservas', 'Reservas'),
('reservations_create', 'Crear Reservas', 'Crear nuevas reservas', 'Reservas'),
('reservations_edit', 'Editar Reservas', 'Modificar reservas', 'Reservas'),
('reservations_delete', 'Eliminar Reservas', 'Eliminar reservas', 'Reservas'),
('reservations_approve', 'Aprobar Reservas', 'Aprobar o rechazar reservas', 'Reservas'),

-- Gestión de Pagos
('payments_view', 'Ver Pagos', 'Ver flujos de pago', 'Pagos'),
('payments_create', 'Crear Pagos', 'Crear flujos de pago', 'Pagos'),
('payments_edit', 'Editar Pagos', 'Modificar flujos de pago', 'Pagos'),
('payments_approve', 'Aprobar Pagos', 'Aprobar pagos de brokers', 'Pagos'),

-- Gestión de Comisiones
('commissions_view', 'Ver Comisiones', 'Ver comisiones de brokers', 'Comisiones'),
('commissions_calculate', 'Calcular Comisiones', 'Calcular comisiones', 'Comisiones'),
('commissions_approve', 'Aprobar Comisiones', 'Aprobar comisiones', 'Comisiones'),

-- Reportes
('reports_view', 'Ver Reportes', 'Acceder a reportes', 'Reportes'),
('reports_export', 'Exportar Reportes', 'Exportar reportes', 'Reportes'),

-- Configuración
('settings_view', 'Ver Configuración', 'Ver configuración del sistema', 'Configuración'),
('settings_edit', 'Editar Configuración', 'Modificar configuración', 'Configuración'),

-- Gestión de Crédito
('credit_view', 'Ver Créditos', 'Ver solicitudes de crédito', 'Crédito'),
('credit_approve', 'Aprobar Créditos', 'Aprobar o rechazar créditos', 'Crédito'),
('credit_edit', 'Editar Créditos', 'Modificar información de créditos', 'Crédito'),

-- Gestión de Brokers
('brokers_view', 'Ver Brokers', 'Ver lista de brokers', 'Brokers'),
('brokers_create', 'Crear Brokers', 'Crear nuevos brokers', 'Brokers'),
('brokers_edit', 'Editar Brokers', 'Modificar información de brokers', 'Brokers'),
('brokers_delete', 'Eliminar Brokers', 'Eliminar brokers', 'Brokers'),

-- Gestión de Inmobiliarias
('agencies_view', 'Ver Inmobiliarias', 'Ver lista de inmobiliarias', 'Inmobiliarias'),
('agencies_create', 'Crear Inmobiliarias', 'Crear nuevas inmobiliarias', 'Inmobiliarias'),
('agencies_edit', 'Editar Inmobiliarias', 'Modificar información de inmobiliarias', 'Inmobiliarias'),
('agencies_delete', 'Eliminar Inmobiliarias', 'Eliminar inmobiliarias', 'Inmobiliarias')
ON CONFLICT (id) DO NOTHING;

-- Insertar permisos por defecto para cada tipo de usuario
-- Administrador: todos los permisos
INSERT INTO user_type_permissions (user_type, permission_id, granted)
SELECT 'Administrador', id, true
FROM permissions
ON CONFLICT (user_type, permission_id) DO NOTHING;

-- KAM: permisos de gestión de cuentas y tareas
INSERT INTO user_type_permissions (user_type, permission_id, granted)
SELECT 'KAM', id, granted
FROM permissions
CROSS JOIN (VALUES 
  ('users_view', true),
  ('clients_view', true),
  ('clients_edit', true),
  ('reservations_view', true),
  ('reservations_edit', true),
  ('reservations_approve', true),
  ('payments_view', true),
  ('commissions_view', true),
  ('reports_view', true),
  ('brokers_view', true),
  ('agencies_view', true)
) AS default_permissions(permission_id, granted)
WHERE permissions.id = default_permissions.permission_id
ON CONFLICT (user_type, permission_id) DO NOTHING;

-- Gestor de Pagos: permisos relacionados con pagos y comisiones
INSERT INTO user_type_permissions (user_type, permission_id, granted)
SELECT 'Gestor de Pagos', id, granted
FROM permissions
CROSS JOIN (VALUES 
  ('payments_view', true),
  ('payments_create', true),
  ('payments_edit', true),
  ('payments_approve', true),
  ('commissions_view', true),
  ('commissions_calculate', true),
  ('commissions_approve', true),
  ('reports_view', true),
  ('reports_export', true),
  ('brokers_view', true),
  ('brokers_edit', true)
) AS default_permissions(permission_id, granted)
WHERE permissions.id = default_permissions.permission_id
ON CONFLICT (user_type, permission_id) DO NOTHING;

-- Supervisor: permisos de supervisión
INSERT INTO user_type_permissions (user_type, permission_id, granted)
SELECT 'Supervisor', id, granted
FROM permissions
CROSS JOIN (VALUES 
  ('users_view', true),
  ('clients_view', true),
  ('reservations_view', true),
  ('reservations_approve', true),
  ('payments_view', true),
  ('commissions_view', true),
  ('reports_view', true),
  ('reports_export', true),
  ('brokers_view', true),
  ('agencies_view', true)
) AS default_permissions(permission_id, granted)
WHERE permissions.id = default_permissions.permission_id
ON CONFLICT (user_type, permission_id) DO NOTHING;

-- Operaciones: permisos de gestión de operaciones
INSERT INTO user_type_permissions (user_type, permission_id, granted)
SELECT 'Operaciones', id, granted
FROM permissions
CROSS JOIN (VALUES 
  ('clients_view', true),
  ('clients_edit', true),
  ('reservations_view', true),
  ('reservations_edit', true),
  ('payments_view', true),
  ('reports_view', true),
  ('brokers_view', true),
  ('agencies_view', true)
) AS default_permissions(permission_id, granted)
WHERE permissions.id = default_permissions.permission_id
ON CONFLICT (user_type, permission_id) DO NOTHING;

-- Gestor de Crédito: permisos relacionados con créditos
INSERT INTO user_type_permissions (user_type, permission_id, granted)
SELECT 'Gestor de Crédito', id, granted
FROM permissions
CROSS JOIN (VALUES 
  ('credit_view', true),
  ('credit_approve', true),
  ('credit_edit', true),
  ('clients_view', true),
  ('reservations_view', true),
  ('reports_view', true),
  ('reports_export', true)
) AS default_permissions(permission_id, granted)
WHERE permissions.id = default_permissions.permission_id
ON CONFLICT (user_type, permission_id) DO NOTHING;

-- Crear trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_user_type_permissions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_type_permissions_updated_at
  BEFORE UPDATE ON user_type_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_type_permissions_updated_at();

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_user_type_permissions_user_type ON user_type_permissions(user_type);
CREATE INDEX idx_user_type_permissions_permission_id ON user_type_permissions(permission_id);
CREATE INDEX idx_permissions_category ON permissions(category); 