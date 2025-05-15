/*
  # Create Payment Flow Schema

  1. New Tables
    - `payment_flows`: Define different types of payment flows
    - `payment_flow_stages`: Stages within a flow
    - `payment_flow_tasks`: Tasks within a stage
    - `commission_flows`: Link commissions to flows
    - `commission_flow_tasks`: Track task progress
    - `commission_task_assignments`: Track task assignments
    - `commission_task_comments`: Comments on tasks

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create payment_flows table
CREATE TABLE payment_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create payment_flow_stages table
CREATE TABLE payment_flow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid REFERENCES payment_flows(id) NOT NULL,
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

-- Create payment_flow_tasks table
CREATE TABLE payment_flow_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid REFERENCES payment_flow_stages(id) NOT NULL,
  name text NOT NULL,
  description text,
  "order" integer NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  default_assignee_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(stage_id, "order")
);

-- Create commission_flows table
CREATE TABLE commission_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_commission_id uuid REFERENCES broker_commissions(id) ON DELETE CASCADE NOT NULL,
  flow_id uuid REFERENCES payment_flows(id) NOT NULL,
  current_stage_id uuid REFERENCES payment_flow_stages(id),
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  is_second_payment boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(broker_commission_id, is_second_payment)
);

-- Create commission_flow_tasks table
CREATE TABLE commission_flow_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_flow_id uuid REFERENCES commission_flows(id) ON DELETE CASCADE NOT NULL,
  task_id uuid REFERENCES payment_flow_tasks(id) NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
  started_at timestamptz,
  completed_at timestamptz,
  assigned_at timestamptz,
  assignee_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(commission_flow_id, task_id)
);

-- Create commission_task_comments table
CREATE TABLE commission_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_flow_task_id uuid REFERENCES commission_flow_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payment_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_flow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_flow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_flow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_task_comments ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX payment_flow_stages_flow_id_idx ON payment_flow_stages(flow_id);
CREATE INDEX payment_flow_tasks_stage_id_idx ON payment_flow_tasks(stage_id);
CREATE INDEX commission_flows_broker_commission_id_idx ON commission_flows(broker_commission_id);
CREATE INDEX commission_flow_tasks_commission_flow_id_idx ON commission_flow_tasks(commission_flow_id);
CREATE INDEX commission_task_comments_task_id_idx ON commission_task_comments(commission_flow_task_id);

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver flujos de pago"
  ON payment_flows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver etapas de flujo"
  ON payment_flow_stages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver tareas de flujo"
  ON payment_flow_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver flujos de comisión"
  ON commission_flows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver tareas de comisión"
  ON commission_flow_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden ver comentarios"
  ON commission_task_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear comentarios"
  ON commission_task_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create triggers for updating updated_at
CREATE TRIGGER update_payment_flows_updated_at
  BEFORE UPDATE ON payment_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payment_flow_stages_updated_at
  BEFORE UPDATE ON payment_flow_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_payment_flow_tasks_updated_at
  BEFORE UPDATE ON payment_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_commission_flows_updated_at
  BEFORE UPDATE ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_commission_flow_tasks_updated_at
  BEFORE UPDATE ON commission_flow_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Insert default payment flows
DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
BEGIN
  -- Insert default flow for first payment
  INSERT INTO payment_flows (name, description)
  VALUES ('Flujo de Pago Principal', 'Flujo estándar para el primer pago o pago único')
  RETURNING id INTO v_flow_id;

  -- Insert stages for first payment flow
  INSERT INTO payment_flow_stages (flow_id, name, description, "order")
  VALUES
    (v_flow_id, 'Solicitud Liquidación', 'Proceso de solicitud de liquidación', 1),
    (v_flow_id, 'Aprobación Jefe Inversiones', 'Proceso de aprobación por Jefe de Inversiones', 2),
    (v_flow_id, 'Aprobación Gerente Comercial', 'Proceso de aprobación por Gerente Comercial', 3),
    (v_flow_id, 'Aprobación Operaciones', 'Proceso de aprobación por Operaciones', 4),
    (v_flow_id, 'Aprobación Control de Gestión', 'Proceso de aprobación por Control de Gestión', 5),
    (v_flow_id, 'Orden de Compra', 'Proceso de generación y aprobación de OC', 6),
    (v_flow_id, 'Facturación', 'Proceso de facturación', 7),
    (v_flow_id, 'Pago', 'Proceso de pago', 8);

  -- Insert tasks for each stage
  FOR v_stage_id IN (SELECT id FROM payment_flow_stages WHERE flow_id = v_flow_id ORDER BY "order")
  LOOP
    CASE (SELECT "order" FROM payment_flow_stages WHERE id = v_stage_id)
      WHEN 1 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES (v_stage_id, 'Solicitud Liquidación', 'Solicitud inicial de liquidación', 1);
      
      WHEN 2 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES 
          (v_stage_id, 'Solicitud a Jefe Inversiones', 'Envío de solicitud a Jefe de Inversiones', 1),
          (v_stage_id, 'VB Jefe Inversiones', 'Visto bueno del Jefe de Inversiones', 2);
      
      WHEN 3 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES 
          (v_stage_id, 'Solicitud Gerente Comercial', 'Envío de solicitud a Gerente Comercial', 1),
          (v_stage_id, 'VB Gerente Comercial', 'Visto bueno del Gerente Comercial', 2);
      
      WHEN 4 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES 
          (v_stage_id, 'Solicitud Operaciones', 'Envío de solicitud a Operaciones', 1),
          (v_stage_id, 'VB Operaciones', 'Visto bueno de Operaciones', 2);
      
      WHEN 5 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES 
          (v_stage_id, 'Solicitud Control de Gestión', 'Envío de solicitud a Control de Gestión', 1),
          (v_stage_id, 'VB Control de Gestión', 'Visto bueno de Control de Gestión', 2);
      
      WHEN 6 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES 
          (v_stage_id, 'Generación de OC', 'Generación de la Orden de Compra', 1),
          (v_stage_id, 'VB OC Gerencia Comercial', 'Visto bueno de OC por Gerencia Comercial', 2),
          (v_stage_id, 'VB OC Gerencia General', 'Visto bueno de OC por Gerencia General', 3),
          (v_stage_id, 'Envío OC Broker', 'Envío de OC al Broker', 4);
      
      WHEN 7 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES 
          (v_stage_id, 'Recepción Factura Broker', 'Recepción de factura del Broker', 1),
          (v_stage_id, 'Generación de Entrada', 'Generación de entrada en sistema', 2),
          (v_stage_id, 'Aprobación de Entrada', 'Aprobación de la entrada generada', 3);
      
      WHEN 8 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES 
          (v_stage_id, 'Notificación a Finanzas', 'Notificación del pago a Finanzas', 1),
          (v_stage_id, 'Fecha de Pago', 'Registro de fecha de pago efectivo', 2);
    END CASE;
  END LOOP;

  -- Insert default flow for second payment
  INSERT INTO payment_flows (name, description)
  VALUES ('Flujo de Segundo Pago', 'Flujo para el segundo pago de comisiones')
  RETURNING id INTO v_flow_id;

  -- Insert stages for second payment flow
  INSERT INTO payment_flow_stages (flow_id, name, description, "order")
  VALUES
    (v_flow_id, 'Entrada', 'Proceso de entrada', 1),
    (v_flow_id, 'Facturación', 'Proceso de facturación', 2),
    (v_flow_id, 'Pago', 'Proceso de pago', 3);

  -- Insert tasks for each stage
  FOR v_stage_id IN (SELECT id FROM payment_flow_stages WHERE flow_id = v_flow_id ORDER BY "order")
  LOOP
    CASE (SELECT "order" FROM payment_flow_stages WHERE id = v_stage_id)
      WHEN 1 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES 
          (v_stage_id, 'Generación de Entrada', 'Generación de entrada en sistema', 1),
          (v_stage_id, 'Aprobación de Entrada', 'Aprobación de la entrada generada', 2),
          (v_stage_id, 'Envío Entrada Broker', 'Envío de entrada al Broker', 3);
      
      WHEN 2 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES (v_stage_id, 'Recepción Factura Broker', 'Recepción de factura del Broker', 1);
      
      WHEN 3 THEN
        INSERT INTO payment_flow_tasks (stage_id, name, description, "order")
        VALUES (v_stage_id, 'Notificación a Finanzas', 'Notificación del pago a Finanzas', 1);
    END CASE;
  END LOOP;
END $$;