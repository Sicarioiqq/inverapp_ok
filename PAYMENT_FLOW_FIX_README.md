# Solución: Botón "Proceder con Pago" no inicia el flujo

## Problema Identificado

El botón "Proceder con Pago" en el flujo de pago no está iniciando correctamente el flujo cuando se presiona. Este problema es similar al que tuvimos anteriormente con el cambio de estado de las tareas.

## Causa del Problema

El problema se debe a que las **políticas RLS (Row Level Security)** están bloqueando la actualización del estado del flujo de `pending` a `in_progress`. Esto impide que el trigger `handle_flow_status_change` se ejecute correctamente.

## Solución Implementada

### 1. Actualización de Políticas RLS

Se han actualizado las políticas RLS para `commission_flows` para permitir que los usuarios autorizados puedan actualizar el estado del flujo:

- **Administradores**: Pueden actualizar cualquier flujo
- **Vendedores**: Pueden actualizar flujos relacionados con sus reservas
- **Usuarios asignados**: Pueden actualizar flujos donde están asignados a tareas

### 2. Mejora del Trigger

Se ha mejorado la función `handle_flow_status_change` con:

- **Logging detallado**: Para facilitar el debugging
- **Manejo de errores robusto**: Con captura y re-lanzamiento de excepciones
- **Validaciones mejoradas**: Para asegurar que el trigger funcione correctamente

### 3. Función de Debug

Se ha agregado una función `debug_commission_flow()` que permite diagnosticar el estado de un flujo específico.

### 4. Corrección de Flujos Existentes

Se incluye un script que corrige automáticamente cualquier flujo que esté "atascado" en estado `pending` pero con `started_at` establecido.

## Instrucciones de Aplicación

### Paso 1: Aplicar la Migración

1. Ve al panel de administración de Supabase
2. Navega a la sección "SQL Editor"
3. Copia y pega el contenido del archivo `apply_payment_flow_fix.sql`
4. Ejecuta el script

### Paso 2: Verificar la Aplicación

Después de aplicar la migración, puedes verificar que todo funcione correctamente:

1. **Probar el botón**: Intenta presionar "Proceder con Pago" en un flujo pendiente
2. **Verificar logs**: Revisa los logs de Supabase para ver los mensajes de debug
3. **Usar función de debug**: Ejecuta `SELECT * FROM debug_commission_flow('flow_id_here');` para diagnosticar un flujo específico

### Paso 3: Verificación de Seguridad

La solución mantiene la seguridad existente:

- Solo usuarios autorizados pueden iniciar flujos
- Los administradores mantienen acceso completo
- Los vendedores solo pueden gestionar sus propias reservas

## Archivos Creados

1. **`supabase/migrations/20250704121903_fix_payment_flow_start_button.sql`**: Migración oficial
2. **`apply_payment_flow_fix.sql`**: Script SQL para aplicar manualmente
3. **`PAYMENT_FLOW_FIX_README.md`**: Este archivo con las instrucciones

## Troubleshooting

### Si el problema persiste:

1. **Verificar logs**: Revisa los logs de Supabase para errores específicos
2. **Probar función de debug**: Usa `debug_commission_flow()` para diagnosticar
3. **Verificar permisos**: Asegúrate de que el usuario tenga los permisos necesarios
4. **Revisar trigger**: Verifica que el trigger esté activo con `\d+ commission_flows`

### Comandos útiles para debugging:

```sql
-- Verificar el estado de un flujo específico
SELECT * FROM debug_commission_flow('flow_id_here');

-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'commission_flows';

-- Verificar triggers
SELECT * FROM pg_trigger WHERE tgrelid = 'commission_flows'::regclass;
```

## Notas Importantes

- La solución es **compatible hacia atrás** y no afecta flujos existentes
- Se mantiene toda la funcionalidad de seguridad existente
- Los logs de debug se pueden desactivar en producción si es necesario
- La función de debug es útil para el mantenimiento futuro

## Contacto

Si encuentras algún problema después de aplicar esta solución, revisa los logs de Supabase y usa la función de debug para diagnosticar el problema específico. 