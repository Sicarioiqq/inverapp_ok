# Sistema de Notificaciones en Tiempo Real

## Descripción

Este sistema implementa notificaciones en tiempo real para el contador de tareas en el topbar de InverAPP, reemplazando el sistema anterior que usaba polling (actualización cada minuto) por Supabase Realtime.

## Características

- ✅ **Actualización en tiempo real**: El contador se actualiza instantáneamente cuando hay cambios
- ✅ **Múltiples fuentes**: Monitorea cambios en tareas de reservas y pagos
- ✅ **Indicador visual**: Muestra el estado de conexión Realtime en el topbar
- ✅ **Manejo de errores**: Reconexión automática y manejo de errores
- ✅ **Limpieza de recursos**: Suscripciones se limpian correctamente al desmontar

## Componentes Implementados

### 1. Hook `useRealtimeTaskCount`

**Archivo**: `src/hooks/useRealtimeTaskCount.ts`

**Funcionalidad**:
- Maneja suscripciones a múltiples tablas de Supabase
- Actualiza el contador cuando detecta cambios
- Proporciona estado de conexión y manejo de errores

**Tablas monitoreadas**:
- `task_assignments` - Tareas de flujo de reservas
- `commission_flow_tasks` - Tareas de flujo de pagos
- `collapsed_tasks` - Tareas ocultas temporalmente
- `reservation_flows` - Estados de flujos de reservas
- `commission_flows` - Estados de flujos de pagos

### 2. Modificaciones en Layout

**Archivo**: `src/components/Layout.tsx`

**Cambios**:
- Reemplazado `setInterval` por hook de Realtime
- Agregado indicador visual de conexión (Wifi/WifiOff)
- Eliminada función `fetchPendingTasksCount` (ya no necesaria)

### 3. Migración de Base de Datos

**Archivo**: `supabase/migrations/20250403000000_enable_realtime_tables.sql`

**Funcionalidad**:
- Habilita Realtime para todas las tablas necesarias
- Agrega comentarios explicativos

## Instalación y Configuración

### 1. Aplicar Migración

```bash
# Ejecutar el script de migración
node scripts/apply-realtime-migration.js
```

### 2. Verificar Configuración

Asegúrate de que las siguientes variables de entorno estén configuradas:

```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### 3. Verificar Policies RLS

Las siguientes policies deben estar configuradas para permitir lectura de las tablas:

```sql
-- Ejemplo para task_assignments
CREATE POLICY "Users can view their own task assignments" ON task_assignments
FOR SELECT USING (auth.uid() = user_id);

-- Ejemplo para commission_flow_tasks
CREATE POLICY "Users can view their assigned commission tasks" ON commission_flow_tasks
FOR SELECT USING (auth.uid() = assignee_id);
```

## Uso

### Indicador Visual

En el topbar, junto al valor de UF, aparecerá un indicador de conexión:

- 🟢 **Wifi + "En vivo"**: Conexión Realtime activa
- 🔴 **WifiOff + "Offline"**: Sin conexión Realtime (con tooltip del error)

### Logs de Consola

El sistema registra eventos en la consola del navegador:

```
Task assignment change detected: {event: 'INSERT', ...}
Commission flow task change detected: {event: 'UPDATE', ...}
Task assignments subscription status: SUBSCRIBED
```

## Eventos Monitoreados

### INSERT
- Nueva tarea asignada al usuario
- Nueva tarea de comisión asignada
- Nueva tarea oculta

### UPDATE
- Cambio de estado de tarea
- Cambio de estado de flujo
- Actualización de tarea oculta

### DELETE
- Tarea desasignada
- Tarea eliminada
- Tarea oculta eliminada

## Troubleshooting

### Problema: No se reciben eventos Realtime

**Solución**:
1. Verificar que la migración se aplicó correctamente
2. Revisar policies RLS en Supabase Dashboard
3. Verificar conexión a internet
4. Revisar logs de consola para errores

### Problema: Contador no se actualiza

**Solución**:
1. Verificar que el usuario está autenticado
2. Revisar que las policies permiten lectura
3. Verificar que las tablas tienen datos

### Problema: Indicador muestra "Offline"

**Solución**:
1. Verificar conexión a Supabase
2. Revisar variables de entorno
3. Verificar que Realtime está habilitado en el proyecto

## Ventajas vs Sistema Anterior

| Aspecto | Sistema Anterior (Polling) | Sistema Actual (Realtime) |
|---------|---------------------------|---------------------------|
| **Actualización** | Cada 60 segundos | Instantánea |
| **Consumo de recursos** | Alto (consultas constantes) | Bajo (solo cuando hay cambios) |
| **Experiencia de usuario** | Retraso de hasta 1 minuto | Tiempo real |
| **Escalabilidad** | Limitada | Mejor |
| **Confiabilidad** | Dependiente de intervalos | Dependiente de WebSocket |

## Próximos Pasos

1. **Extender a otros componentes**: Aplicar Realtime a otros contadores del sistema
2. **Notificaciones push**: Implementar notificaciones push del navegador
3. **Optimización**: Implementar debouncing para múltiples eventos rápidos
4. **Métricas**: Agregar métricas de rendimiento del sistema Realtime

## Soporte

Para problemas o preguntas sobre el sistema de notificaciones en tiempo real, revisa:

1. Logs de consola del navegador
2. Supabase Dashboard > Realtime
3. Network tab para verificar conexiones WebSocket
4. Policies RLS en Supabase Dashboard 