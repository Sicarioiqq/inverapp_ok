/*
  # Handle existing commission flows before schema changes

  1. Changes
    - Create temporary table for existing commission flows
    - Backup any existing data
    - Drop existing tables in correct order
    - Recreate tables with new schema
    - Restore backed up data
*/

-- First, create temporary table and backup any existing data
CREATE TEMP TABLE IF NOT EXISTS temp_commission_flows AS
SELECT * FROM commission_flows WHERE false;

INSERT INTO temp_commission_flows
SELECT * FROM commission_flows WHERE id IS NOT NULL;

-- Drop existing tables in correct order
DROP TABLE IF EXISTS commission_task_comments CASCADE;
DROP TABLE IF EXISTS commission_flow_tasks CASCADE;
DROP TABLE IF EXISTS commission_flows CASCADE;
DROP TABLE IF EXISTS payment_flow_tasks CASCADE;
DROP TABLE IF EXISTS payment_flow_stages CASCADE;
DROP TABLE IF EXISTS payment_flows CASCADE;

-- Now recreate all tables with correct schema
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

-- Restore any backed up data
INSERT INTO commission_flows
SELECT * FROM temp_commission_flows;

-- Drop temporary table
DROP TABLE temp_commission_flows;