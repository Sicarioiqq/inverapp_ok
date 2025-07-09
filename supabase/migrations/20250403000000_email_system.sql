/*
  # Sistema de Emails Automáticos

  1. Nuevas Funcionalidades
    - Tabla para logs de emails enviados
    - Triggers para enviar emails automáticamente
    - Configuración de templates de email
    
  2. Cambios
    - Crear tabla email_logs
    - Crear función para enviar emails
    - Crear triggers para eventos específicos
    
  3. Seguridad
    - Mantener las políticas RLS existentes
    - Logs de emails para auditoría
*/

-- Crear tabla para logs de emails
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  data jsonb,
  sent_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Crear índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS email_logs_email_type_idx ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS email_logs_recipient_email_idx ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS email_logs_status_idx ON email_logs(status);

-- Habilitar RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para email_logs
CREATE POLICY "Usuarios autenticados pueden ver logs de emails"
  ON email_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo el sistema puede crear logs de emails"
  ON email_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Función para enviar email usando Edge Function
CREATE OR REPLACE FUNCTION send_email_notification(
  p_email_type text,
  p_recipient_email text,
  p_recipient_name text,
  p_data jsonb
)
RETURNS void AS $$
DECLARE
  v_supabase_url text;
  v_anon_key text;
  v_response jsonb;
BEGIN
  -- Obtener configuración de Supabase
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  -- Llamar a la Edge Function
  SELECT content::jsonb INTO v_response
  FROM http((
    'POST',
    v_supabase_url || '/functions/v1/send-email',
    ARRAY[
      ('Authorization', 'Bearer ' || v_anon_key),
      ('Content-Type', 'application/json')
    ],
    'application/json',
    json_build_object(
      'email_type', p_email_type,
      'recipient_email', p_recipient_email,
      'recipient_name', p_recipient_name,
      'data', p_data
    )::text
  ));
  
  -- Log del intento de envío
  INSERT INTO email_logs (
    email_type,
    recipient_email,
    recipient_name,
    data,
    status
  ) VALUES (
    p_email_type,
    p_recipient_email,
    p_recipient_name,
    p_data,
    CASE 
      WHEN v_response->>'success' = 'true' THEN 'sent'
      ELSE 'failed'
    END
  );
  
  -- Si hubo error, registrar el mensaje
  IF v_response->>'error' IS NOT NULL THEN
    UPDATE email_logs 
    SET error_message = v_response->>'error'
    WHERE recipient_email = p_recipient_email 
    AND email_type = p_email_type
    AND sent_at = (
      SELECT MAX(sent_at) 
      FROM email_logs 
      WHERE recipient_email = p_recipient_email 
      AND email_type = p_email_type
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log del error
    INSERT INTO email_logs (
      email_type,
      recipient_email,
      recipient_name,
      data,
      status,
      error_message
    ) VALUES (
      p_email_type,
      p_recipient_email,
      p_recipient_name,
      p_data,
      'failed',
      SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para enviar email cuando se asigna una tarea
CREATE OR REPLACE FUNCTION handle_task_assignment_email()
RETURNS TRIGGER AS $$
DECLARE
  v_assignee_email text;
  v_assignee_name text;
  v_task_data jsonb;
  v_task_name text;
  v_project_name text;
  v_client_name text;
  v_reservation_number text;
  v_apartment_number text;
BEGIN
  -- Solo enviar email si es una nueva asignación
  IF TG_OP = 'INSERT' THEN
    -- Obtener información del usuario asignado
    SELECT email, first_name || ' ' || last_name
    INTO v_assignee_email, v_assignee_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Obtener información de la tarea y reserva
    IF NEW.reservation_flow_id IS NOT NULL THEN
      -- Tarea de flujo de reserva
      SELECT 
        t.name,
        p.name,
        c.first_name || ' ' || c.last_name,
        r.reservation_number,
        r.apartment_number
      INTO v_task_name, v_project_name, v_client_name, v_reservation_number, v_apartment_number
      FROM sale_flow_tasks t
      JOIN reservation_flows rf ON rf.id = NEW.reservation_flow_id
      JOIN reservations r ON r.id = rf.reservation_id
      JOIN projects p ON p.id = r.project_id
      JOIN clients c ON c.id = r.client_id
      WHERE t.id = NEW.task_id;
      
      v_task_data := jsonb_build_object(
        'task_name', v_task_name,
        'project_name', v_project_name,
        'client_name', v_client_name,
        'reservation_number', v_reservation_number,
        'apartment_number', v_apartment_number
      );
      
      -- Enviar email
      PERFORM send_email_notification(
        'task_assigned',
        v_assignee_email,
        v_assignee_name,
        v_task_data
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para enviar email cuando se asigna una tarea
DROP TRIGGER IF EXISTS on_task_assignment_email ON task_assignments;
CREATE TRIGGER on_task_assignment_email
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_assignment_email();

-- Función para enviar email cuando se completa una tarea
CREATE OR REPLACE FUNCTION handle_task_completion_email()
RETURNS TRIGGER AS $$
DECLARE
  v_completed_by_email text;
  v_completed_by_name text;
  v_task_data jsonb;
  v_task_name text;
  v_project_name text;
  v_client_name text;
  v_reservation_number text;
  v_apartment_number text;
BEGIN
  -- Solo enviar email si la tarea se completó
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Obtener información de quién completó la tarea
    SELECT email, first_name || ' ' || last_name
    INTO v_completed_by_email, v_completed_by_name
    FROM profiles
    WHERE id = NEW.updated_by;
    
    -- Obtener información de la tarea y reserva
    IF NEW.reservation_flow_id IS NOT NULL THEN
      -- Tarea de flujo de reserva
      SELECT 
        t.name,
        p.name,
        c.first_name || ' ' || c.last_name,
        r.reservation_number,
        r.apartment_number
      INTO v_task_name, v_project_name, v_client_name, v_reservation_number, v_apartment_number
      FROM sale_flow_tasks t
      JOIN reservation_flows rf ON rf.id = NEW.reservation_flow_id
      JOIN reservations r ON r.id = rf.reservation_id
      JOIN projects p ON p.id = r.project_id
      JOIN clients c ON c.id = r.client_id
      WHERE t.id = NEW.task_id;
      
      v_task_data := jsonb_build_object(
        'task_name', v_task_name,
        'project_name', v_project_name,
        'client_name', v_client_name,
        'reservation_number', v_reservation_number,
        'apartment_number', v_apartment_number,
        'completed_by', v_completed_by_name
      );
      
      -- Enviar email a todos los usuarios con permisos de administrador
      FOR v_completed_by_email, v_completed_by_name IN
        SELECT email, first_name || ' ' || last_name
        FROM profiles
        WHERE user_type IN ('Administrador', 'Gerente')
      LOOP
        PERFORM send_email_notification(
          'task_completed',
          v_completed_by_email,
          v_completed_by_name,
          v_task_data
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para enviar email cuando se completa una tarea
DROP TRIGGER IF EXISTS on_task_completion_email ON reservation_flow_tasks;
CREATE TRIGGER on_task_completion_email
  AFTER UPDATE OF status ON reservation_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_completion_email();

-- Función para enviar email cuando se crea una nueva reserva
CREATE OR REPLACE FUNCTION handle_reservation_created_email()
RETURNS TRIGGER AS $$
DECLARE
  v_seller_email text;
  v_seller_name text;
  v_task_data jsonb;
BEGIN
  -- Solo enviar email si es una nueva reserva
  IF TG_OP = 'INSERT' THEN
    -- Obtener información del vendedor
    SELECT email, first_name || ' ' || last_name
    INTO v_seller_email, v_seller_name
    FROM profiles
    WHERE id = NEW.seller_id;
    
    v_task_data := jsonb_build_object(
      'reservation_number', NEW.reservation_number,
      'client_name', (
        SELECT first_name || ' ' || last_name 
        FROM clients 
        WHERE id = NEW.client_id
      ),
      'project_name', (
        SELECT name 
        FROM projects 
        WHERE id = NEW.project_id
      ),
      'apartment_number', NEW.apartment_number,
      'total_payment', NEW.total_payment
    );
    
    -- Enviar email al vendedor
    PERFORM send_email_notification(
      'reservation_created',
      v_seller_email,
      v_seller_name,
      v_task_data
    );
    
    -- Enviar email a administradores
    FOR v_seller_email, v_seller_name IN
      SELECT email, first_name || ' ' || last_name
      FROM profiles
      WHERE user_type IN ('Administrador', 'Gerente')
    LOOP
      PERFORM send_email_notification(
        'reservation_created',
        v_seller_email,
        v_seller_name,
        v_task_data
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para enviar email cuando se crea una reserva
DROP TRIGGER IF EXISTS on_reservation_created_email ON reservations;
CREATE TRIGGER on_reservation_created_email
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION handle_reservation_created_email(); 