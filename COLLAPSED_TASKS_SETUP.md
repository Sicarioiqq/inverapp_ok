# Configuración de Tareas Contraídas Temporalmente

## Descripción
Esta funcionalidad permite a los usuarios ocultar temporalmente tareas pendientes por 24 horas, mejorando la gestión del flujo de trabajo.

## Características
- **Contracción temporal**: Las tareas se ocultan por 24 horas
- **Exclusión del contador**: Las tareas contraídas no aparecen en el contador del header
- **Expansión manual**: Los usuarios pueden expandir las tareas antes de que expiren
- **Limpieza automática**: Las tareas expiradas se eliminan automáticamente
- **Modal de gestión**: Interfaz para ver y gestionar tareas contraídas

## Configuración de Base de Datos

### 1. Aplicar la migración
Ejecuta el siguiente SQL en tu base de datos Supabase:

```sql
-- Crear tabla para tareas contraídas temporalmente
CREATE TABLE IF NOT EXISTS collapsed_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_assignment_id UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  collapsed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, task_assignment_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_collapsed_tasks_user_id ON collapsed_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_collapsed_tasks_expires_at ON collapsed_tasks(expires_at);
CREATE INDEX IF NOT EXISTS idx_collapsed_tasks_task_assignment_id ON collapsed_tasks(task_assignment_id);

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
```

### 2. Verificar la configuración
Después de aplicar la migración, verifica que:
- La tabla `collapsed_tasks` existe
- Los índices se crearon correctamente
- Las políticas RLS están activas
- El trigger se creó correctamente

## Funcionalidades Implementadas

### En TareasAsignadas.tsx
- **Botón "Ocultar"**: En cada tarea (vista tabla y kanban)
- **Contador de tareas ocultas**: Muestra cuántas tareas están contraídas
- **Modal de gestión**: Para ver y expandir tareas contraídas
- **Filtrado automático**: Las tareas contraídas no aparecen en la lista principal

### En Layout.tsx
- **Contador actualizado**: Excluye tareas contraídas del contador del header
- **Actualización automática**: Se actualiza cuando las tareas se contraen/expanden

### Componente CollapsedTasksModal.tsx
- **Lista de tareas contraídas**: Muestra todas las tareas ocultas temporalmente
- **Tiempo restante**: Indica cuánto tiempo falta para que expire
- **Botón de expansión**: Permite mostrar la tarea antes de que expire
- **Información detallada**: Muestra datos de la tarea, cliente, proyecto, etc.

## Uso

### Contraer una tarea
1. Ve a "Mis Tareas Pendientes"
2. Haz clic en el botón "Ocultar" en cualquier tarea
3. La tarea desaparecerá de la lista por 24 horas
4. El contador del header se actualizará automáticamente

### Ver tareas contraídas
1. En "Mis Tareas Pendientes", verás un botón naranja con el número de tareas ocultas
2. Haz clic en el botón para abrir el modal
3. Verás todas las tareas contraídas con tiempo restante
4. Puedes expandir cualquier tarea haciendo clic en "Mostrar"

### Expansión automática
- Las tareas se expanden automáticamente después de 24 horas
- Aparecerán nuevamente en la lista principal
- El contador del header se actualizará

## Beneficios
- **Mejor gestión**: Los usuarios pueden ocultar tareas que ya gestionaron
- **Reducción de ruido**: El contador del header solo muestra tareas realmente pendientes
- **Flexibilidad**: Los usuarios pueden expandir tareas cuando las necesiten
- **Automatización**: No requiere intervención manual para la limpieza

## Notas Técnicas
- Las tareas contraídas se almacenan en la tabla `collapsed_tasks`
- Cada usuario solo ve sus propias tareas contraídas (RLS)
- La limpieza automática se ejecuta antes de cada inserción
- El sistema es compatible con las tareas existentes 