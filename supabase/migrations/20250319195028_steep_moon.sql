/*
  # Sales Flow Schema

  1. New Tables
    - `sale_flows`: Define different types of sale flows
    - `sale_flow_stages`: Stages within a flow
    - `sale_flow_tasks`: Tasks within a stage
    - `reservation_flows`: Link reservations to flows
    - `reservation_flow_tasks`: Track task progress
    - `task_assignments`: Track task assignments
    - `task_comments`: Comments on tasks

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create sale_flows table
CREATE TABLE sale_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create sale_flow_stages table
CREATE TABLE sale_flow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid REFERENCES sale_flows(id) NOT NULL,
  name text NOT NULL,
  description text,
  "order" integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(flow_id, "order")
);

-- Create sale_flow_tasks table
CREATE TABLE sale_flow_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid REFERENCES sale_flow_stages(id) NOT NULL,
  name text NOT NULL,
  description text,
  "order" integer NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  parent_task_id uuid REFERENCES sale_flow_tasks(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(stage_id, "order")
);

-- Create reservation_flows table
CREATE TABLE reservation_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) NOT NULL,
  flow_id uuid REFERENCES sale_flows(id) NOT NULL,
  current_stage_id uuid REFERENCES sale_flow_stages(id),
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(reservation_id)
);

-- Create reservation_flow_tasks table
CREATE TABLE reservation_flow_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_flow_id uuid REFERENCES reservation_flows(id) NOT NULL,
  task_id uuid REFERENCES sale_flow_tasks(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  started_at timestamptz,
  completed_at timestamptz,
  due_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(reservation_flow_id, task_id)
);

-- Create task_assignments table
CREATE TABLE task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_flow_task_id uuid REFERENCES reservation_flow_tasks(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(reservation_flow_task_id, user_id)
);

-- Create task_comments table
CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_flow_task_id uuid REFERENCES reservation_flow_tasks(id) NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  content text NOT NULL,
  mentioned_users uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE sale_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_flow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_flow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_flow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver flujos de venta" ON sale_flows
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver etapas de flujo" ON sale_flow_stages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver tareas de flujo" ON sale_flow_tasks
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver flujos de reserva" ON reservation_flows
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver tareas de reserva" ON reservation_flow_tasks
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver asignaciones" ON task_assignments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver comentarios" ON task_comments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear comentarios" ON task_comments
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX sale_flow_stages_flow_id_idx ON sale_flow_stages(flow_id);
CREATE INDEX sale_flow_tasks_stage_id_idx ON sale_flow_tasks(stage_id);
CREATE INDEX reservation_flows_reservation_id_idx ON reservation_flows(reservation_id);
CREATE INDEX reservation_flow_tasks_reservation_flow_id_idx ON reservation_flow_tasks(reservation_flow_id);
CREATE INDEX task_assignments_reservation_flow_task_id_idx ON task_assignments(reservation_flow_task_id);
CREATE INDEX task_comments_reservation_flow_task_id_idx ON task_comments(reservation_flow_task_id);

-- Create triggers for updated_at
CREATE TRIGGER update_sale_flows_updated_at
  BEFORE UPDATE ON sale_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sale_flow_stages_updated_at
  BEFORE UPDATE ON sale_flow_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sale_flow_tasks_updated_at
  BEFORE UPDATE ON sale_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reservation_flows_updated_at
  BEFORE UPDATE ON reservation_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reservation_flow_tasks_updated_at
  BEFORE UPDATE ON reservation_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_task_assignments_updated_at
  BEFORE UPDATE ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert default sale flow and its stages/tasks
DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
BEGIN
  -- Insert default flow
  INSERT INTO sale_flows (name, description)
  VALUES ('Flujo de Venta Regular', 'Flujo estándar para ventas sin broker')
  RETURNING id INTO v_flow_id;

  -- Insert Reserva stage and its tasks
  INSERT INTO sale_flow_stages (flow_id, name, description, "order")
  VALUES (v_flow_id, 'Reserva', 'Proceso de reserva inicial', 1)
  RETURNING id INTO v_stage_id;
  
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required) VALUES
    (v_stage_id, 'Verificar disponibilidad', 'Confirmar disponibilidad de la unidad', 1, true),
    (v_stage_id, 'Registrar datos del cliente', 'Ingresar información del cliente', 2, true),
    (v_stage_id, 'Procesar pago de reserva', 'Gestionar el pago de la reserva', 3, true);

  -- Insert Documentación stage and its tasks
  INSERT INTO sale_flow_stages (flow_id, name, description, "order")
  VALUES (v_flow_id, 'Documentación', 'Recopilación y verificación de documentos', 2)
  RETURNING id INTO v_stage_id;
  
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required) VALUES
    (v_stage_id, 'Solicitar documentos', 'Pedir documentación necesaria al cliente', 1, true),
    (v_stage_id, 'Verificar documentos', 'Revisar documentación recibida', 2, true),
    (v_stage_id, 'Aprobar documentación', 'Validación final de documentos', 3, true);

  -- Insert Promesa stage and its tasks
  INSERT INTO sale_flow_stages (flow_id, name, description, "order")
  VALUES (v_flow_id, 'Promesa', 'Firma de promesa de compraventa', 3)
  RETURNING id INTO v_stage_id;
  
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required) VALUES
    (v_stage_id, 'Generar promesa', 'Preparar documento de promesa', 1, true),
    (v_stage_id, 'Revisar promesa', 'Revisión legal de la promesa', 2, true),
    (v_stage_id, 'Firmar promesa', 'Gestionar firmas de la promesa', 3, true),
    (v_stage_id, 'Procesar pago de promesa', 'Gestionar el pago de la promesa', 4, true);

  -- Insert Escrituración stage and its tasks
  INSERT INTO sale_flow_stages (flow_id, name, description, "order")
  VALUES (v_flow_id, 'Escrituración', 'Proceso de escrituración', 4)
  RETURNING id INTO v_stage_id;
  
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required) VALUES
    (v_stage_id, 'Preparar escritura', 'Elaborar documento de escritura', 1, true),
    (v_stage_id, 'Coordinar firmas', 'Gestionar proceso de firmas', 2, true),
    (v_stage_id, 'Inscribir en CBR', 'Inscripción en Conservador', 3, true);

  -- Insert Entrega stage and its tasks
  INSERT INTO sale_flow_stages (flow_id, name, description, "order")
  VALUES (v_flow_id, 'Entrega', 'Entrega de la propiedad', 5)
  RETURNING id INTO v_stage_id;
  
  INSERT INTO sale_flow_tasks (stage_id, name, description, "order", is_required) VALUES
    (v_stage_id, 'Coordinar entrega', 'Programar entrega de la unidad', 1, true),
    (v_stage_id, 'Realizar entrega', 'Entrega física de la unidad', 2, true),
    (v_stage_id, 'Firmar acta', 'Gestionar firma de acta de entrega', 3, true);
END $$;