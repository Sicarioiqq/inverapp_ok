# Sistema de Emails Automáticos - InverApp

## Descripción General

El sistema de emails automáticos permite enviar notificaciones por correo electrónico de forma automática cuando ocurren ciertos eventos en la aplicación. El sistema está integrado con Supabase Edge Functions y utiliza un proveedor de email externo.

## Características

- ✅ **Emails automáticos** basados en triggers de base de datos
- ✅ **Templates personalizables** para diferentes tipos de notificaciones
- ✅ **Logs completos** de todos los emails enviados
- ✅ **Reintentos automáticos** para emails fallidos
- ✅ **Interfaz de administración** para gestionar el sistema
- ✅ **Exportación de logs** en formato CSV

## Tipos de Emails Automáticos

### 1. Tarea Asignada
- **Cuándo se envía**: Cuando se asigna una nueva tarea a un usuario
- **Destinatarios**: El usuario asignado a la tarea
- **Contenido**: Detalles de la tarea, proyecto, cliente y reserva

### 2. Tarea Completada
- **Cuándo se envía**: Cuando se marca una tarea como completada
- **Destinatarios**: Administradores y gerentes
- **Contenido**: Detalles de la tarea completada y quién la completó

### 3. Nueva Reserva
- **Cuándo se envía**: Cuando se crea una nueva reserva
- **Destinatarios**: Vendedor asignado y administradores
- **Contenido**: Detalles de la reserva, cliente y proyecto

## Configuración Inicial

### 1. Configurar Proveedor de Email

#### Opción A: Resend (Recomendado)
1. Crear cuenta en [Resend](https://resend.com)
2. Obtener API Key
3. Configurar dominio verificado

#### Opción B: SendGrid
1. Crear cuenta en [SendGrid](https://sendgrid.com)
2. Obtener API Key
3. Configurar dominio verificado

#### Opción C: Mailgun
1. Crear cuenta en [Mailgun](https://mailgun.com)
2. Obtener API Key
3. Configurar dominio verificado

### 2. Configurar Variables de Entorno

Agregar las siguientes variables en tu archivo `.env`:

```bash
# Supabase
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key

# Email Provider (Resend)
RESEND_API_KEY=tu_resend_api_key

# O para SendGrid
SENDGRID_API_KEY=tu_sendgrid_api_key

# O para Mailgun
MAILGUN_API_KEY=tu_mailgun_api_key
MAILGUN_DOMAIN=tu_dominio_verificado
```

### 3. Desplegar Edge Function

```bash
# Instalar Supabase CLI si no lo tienes
npm install -g supabase

# Iniciar sesión en Supabase
supabase login

# Vincular proyecto
supabase link --project-ref tu_project_ref

# Desplegar Edge Function
supabase functions deploy send-email
```

### 4. Aplicar Migración de Base de Datos

```bash
# Aplicar la migración del sistema de emails
supabase db push
```

## Estructura del Sistema

### Archivos Principales

```
supabase/
├── functions/
│   └── send-email/
│       └── index.ts          # Edge Function para enviar emails
└── migrations/
    └── 20250403000000_email_system.sql  # Migración del sistema

src/
├── pages/
│   └── settings/
│       └── EmailConfig.tsx   # Interfaz de administración
└── lib/
    └── supabase.ts           # Cliente de Supabase
```

### Tablas de Base de Datos

#### `email_logs`
- `id`: UUID único
- `email_type`: Tipo de email (task_assigned, task_completed, etc.)
- `recipient_email`: Email del destinatario
- `recipient_name`: Nombre del destinatario
- `data`: Datos JSON del email
- `sent_at`: Fecha de envío
- `status`: Estado (pending, sent, failed)
- `error_message`: Mensaje de error si falló

### Triggers Automáticos

1. **`on_task_assignment_email`**: Se activa cuando se asigna una tarea
2. **`on_task_completion_email`**: Se activa cuando se completa una tarea
3. **`on_reservation_created_email`**: Se activa cuando se crea una reserva

## Uso del Sistema

### Acceder a la Configuración

1. Inicia sesión en la aplicación
2. Ve a **Configuración** → **Emails Automáticos**
3. Desde ahí puedes:
   - Ver el historial de emails enviados
   - Filtrar por tipo de email o estado
   - Reintentar emails fallidos
   - Exportar logs en CSV

### Personalizar Templates

Para personalizar los templates de email, edita el archivo `supabase/functions/send-email/index.ts`:

```typescript
const emailTemplates = {
  task_assigned: {
    subject: 'Nueva tarea asignada - InverApp',
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Nueva Tarea Asignada</h2>
        <p>Hola ${recipient_name},</p>
        <!-- Personalizar contenido aquí -->
      </div>
    `
  },
  // Agregar más templates...
};
```

### Agregar Nuevos Tipos de Email

1. **Crear función de trigger** en la migración:

```sql
CREATE OR REPLACE FUNCTION handle_nuevo_evento_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Lógica para enviar email
  PERFORM send_email_notification(
    'nuevo_tipo',
    'email@ejemplo.com',
    'Nombre Usuario',
    '{"datos": "ejemplo"}'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

2. **Crear trigger**:

```sql
CREATE TRIGGER on_nuevo_evento_email
  AFTER INSERT ON tu_tabla
  FOR EACH ROW
  EXECUTE FUNCTION handle_nuevo_evento_email();
```

3. **Agregar template** en la Edge Function
4. **Actualizar interfaz** en `EmailConfig.tsx`

## Monitoreo y Mantenimiento

### Verificar Estado del Sistema

```bash
# Verificar logs de Edge Functions
supabase functions logs send-email

# Verificar estado de la base de datos
supabase db diff
```

### Troubleshooting

#### Emails no se envían
1. Verificar API Key del proveedor de email
2. Verificar logs de Edge Functions
3. Verificar tabla `email_logs` para errores
4. Verificar configuración de dominio

#### Errores de autenticación
1. Verificar variables de entorno
2. Verificar permisos de Supabase
3. Verificar políticas RLS

#### Emails en spam
1. Configurar SPF, DKIM y DMARC
2. Verificar reputación del dominio
3. Usar templates HTML profesionales

## Seguridad

### Políticas de Seguridad

- ✅ Todos los emails se registran en logs
- ✅ Validación de datos antes del envío
- ✅ Rate limiting en Edge Functions
- ✅ Políticas RLS en base de datos
- ✅ Sanitización de contenido HTML

### Mejores Prácticas

1. **No incluir información sensible** en los emails
2. **Usar templates HTML seguros** (sin JavaScript)
3. **Validar emails de destinatarios** antes del envío
4. **Monitorear logs regularmente**
5. **Configurar alertas** para errores críticos

## Costos y Límites

### Resend
- **Gratis**: 3,000 emails/mes
- **Pago**: $20/mes por 50,000 emails

### SendGrid
- **Gratis**: 100 emails/día
- **Pago**: $14.95/mes por 50,000 emails

### Mailgun
- **Gratis**: 5,000 emails/mes
- **Pago**: $35/mes por 50,000 emails

## Soporte

Para problemas o preguntas sobre el sistema de emails:

1. Revisar logs en la interfaz de administración
2. Verificar documentación de Supabase Edge Functions
3. Consultar documentación del proveedor de email
4. Contactar al equipo de desarrollo

## Changelog

### v1.0.0 (2024-04-03)
- ✅ Sistema inicial de emails automáticos
- ✅ Templates para tareas y reservas
- ✅ Interfaz de administración
- ✅ Logs y reintentos automáticos
- ✅ Integración con Supabase Edge Functions 