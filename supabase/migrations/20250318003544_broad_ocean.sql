/*
  # Configuración inicial de tablas de autenticación y roles

  1. Nuevas Tablas
    - `roles`: Almacena los roles del sistema
      - `id` (uuid, clave primaria)
      - `name` (texto, único)
      - `description` (texto)
      - `created_at` (timestamp)
    
    - `user_roles`: Relaciona usuarios con roles
      - `id` (uuid, clave primaria)
      - `user_id` (uuid, referencia a auth.users)
      - `role_id` (uuid, referencia a roles)
      - `created_at` (timestamp)
    
    - `profiles`: Perfiles de usuario
      - `id` (uuid, clave primaria, referencia a auth.users)
      - `full_name` (texto)
      - `avatar_url` (texto)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Seguridad
    - Habilitar RLS en todas las tablas
    - Políticas de acceso para usuarios autenticados
*/

-- Crear tabla de roles
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de relación usuario-rol
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para roles
CREATE POLICY "Usuarios autenticados pueden leer roles" 
  ON roles FOR SELECT 
  TO authenticated 
  USING (true);

-- Políticas de seguridad para user_roles
CREATE POLICY "Usuarios pueden leer sus propios roles" 
  ON user_roles FOR SELECT 
  TO authenticated 
  USING (auth.uid() = user_id);

-- Políticas de seguridad para perfiles
CREATE POLICY "Usuarios pueden leer todos los perfiles" 
  ON profiles FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Usuarios pueden actualizar su propio perfil" 
  ON profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insertar rol de administrador
INSERT INTO roles (name, description)
VALUES ('admin', 'Administrador del sistema con acceso completo')
ON CONFLICT (name) DO NOTHING;