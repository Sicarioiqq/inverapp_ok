-- Crear tabla para tareas contraídas temporalmente
CREATE TABLE IF NOT EXISTS collapsed_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_assignment_id UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  collapsed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scope TEXT NOT NULL DEFAULT 'assigned_to_me',
  UNIQUE(user_id, task_assignment_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_collapsed_tasks_user_id ON collapsed_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_collapsed_tasks_expires_at ON collapsed_tasks(expires_at);
CREATE INDEX IF NOT EXISTS idx_collapsed_tasks_task_assignment_id ON collapsed_tasks(task_assignment_id);
CREATE INDEX IF NOT EXISTS idx_collapsed_tasks_scope ON collapsed_tasks(scope);

-- Función para limpiar tareas expiradas automáticamente
CREATE OR REPLACE FUNCTION cleanup_expired_collapsed_tasks()
RETURNS void AS $$
BEGIN
  DELETE FROM collapsed_tasks WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Crear un trigger para limpiar automáticamente las tareas expiradas
CREATE OR REPLACE FUNCTION trigger_cleanup_expired_collapsed_tasks()
RETURNS trigger AS $$
BEGIN
  PERFORM cleanup_expired_collapsed_tasks();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger que se ejecuta antes de cada inserción
CREATE TRIGGER cleanup_expired_collapsed_tasks_trigger
  BEFORE INSERT ON collapsed_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_cleanup_expired_collapsed_tasks();

-- Políticas RLS
ALTER TABLE collapsed_tasks ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo vean sus propias tareas contraídas
CREATE POLICY "Users can view their own collapsed tasks" ON collapsed_tasks
  FOR SELECT USING (auth.uid() = user_id);

-- Política para que los usuarios puedan insertar sus propias tareas contraídas
CREATE POLICY "Users can insert their own collapsed tasks" ON collapsed_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política para que los usuarios puedan eliminar sus propias tareas contraídas
CREATE POLICY "Users can delete their own collapsed tasks" ON collapsed_tasks
  FOR DELETE USING (auth.uid() = user_id); 