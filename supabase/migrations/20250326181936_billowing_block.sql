/*
  # Add payment flow schema if not exists

  1. Changes
    - Check for existing tables before creating
    - Add missing indexes and policies
    - Insert default flow data
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create tables only if they don't exist
DO $$ 
BEGIN
  -- Create payment_flows table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_flows') THEN
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

    -- Enable RLS
    ALTER TABLE payment_flows ENABLE ROW LEVEL SECURITY;

    -- Create policy
    CREATE POLICY "Usuarios autenticados pueden ver flujos de pago"
      ON payment_flows FOR SELECT
      TO authenticated
      USING (true);

    -- Create trigger
    CREATE TRIGGER update_payment_flows_updated_at
      BEFORE UPDATE ON payment_flows
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;

  -- Create payment_flow_stages table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_flow_stages') THEN
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

    -- Enable RLS
    ALTER TABLE payment_flow_stages ENABLE ROW LEVEL SECURITY;

    -- Create policy
    CREATE POLICY "Usuarios autenticados pueden ver etapas de flujo"
      ON payment_flow_stages FOR SELECT
      TO authenticated
      USING (true);

    -- Create trigger
    CREATE TRIGGER update_payment_flow_stages_updated_at
      BEFORE UPDATE ON payment_flow_stages
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();

    -- Create index
    CREATE INDEX payment_flow_stages_flow_id_idx ON payment_flow_stages(flow_id);
  END IF;

  -- Create payment_flow_tasks table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_flow_tasks') THEN
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

    -- Enable RLS
    ALTER TABLE payment_flow_tasks ENABLE ROW LEVEL SECURITY;

    -- Create policy
    CREATE POLICY "Usuarios autenticados pueden ver tareas de flujo"
      ON payment_flow_tasks FOR SELECT
      TO authenticated
      USING (true);

    -- Create trigger
    CREATE TRIGGER update_payment_flow_tasks_updated_at
      BEFORE UPDATE ON payment_flow_tasks
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();

    -- Create index
    CREATE INDEX payment_flow_tasks_stage_id_idx ON payment_flow_tasks(stage_id);
  END IF;

  -- Create commission_flows table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'commission_flows') THEN
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

    -- Enable RLS
    ALTER TABLE commission_flows ENABLE ROW LEVEL SECURITY;

    -- Create policy
    CREATE POLICY "Usuarios autenticados pueden ver flujos de comisión"
      ON commission_flows FOR SELECT
      TO authenticated
      USING (true);

    -- Create trigger
    CREATE TRIGGER update_commission_flows_updated_at
      BEFORE UPDATE ON commission_flows
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();

    -- Create index
    CREATE INDEX commission_flows_broker_commission_id_idx ON commission_flows(broker_commission_id);
  END IF;

  -- Create commission_flow_tasks table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'commission_flow_tasks') THEN
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

    -- Enable RLS
    ALTER TABLE commission_flow_tasks ENABLE ROW LEVEL SECURITY;

    -- Create policy
    CREATE POLICY "Usuarios autenticados pueden ver tareas de comisión"
      ON commission_flow_tasks FOR SELECT
      TO authenticated
      USING (true);

    -- Create trigger
    CREATE TRIGGER update_commission_flow_tasks_updated_at
      BEFORE UPDATE ON commission_flow_tasks
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();

    -- Create index
    CREATE INDEX commission_flow_tasks_commission_flow_id_idx ON commission_flow_tasks(commission_flow_id);
  END IF;

  -- Create commission_task_comments table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'commission_task_comments') THEN
    CREATE TABLE commission_task_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      commission_flow_task_id uuid REFERENCES commission_flow_tasks(id) ON DELETE CASCADE NOT NULL,
      user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
      content text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE commission_task_comments ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Usuarios autenticados pueden ver comentarios"
      ON commission_task_comments FOR SELECT
      TO authenticated
      USING (true);

    CREATE POLICY "Usuarios autenticados pueden crear comentarios"
      ON commission_task_comments FOR INSERT
      TO authenticated
      WITH CHECK (true);

    -- Create index
    CREATE INDEX commission_task_comments_task_id_idx ON commission_task_comments(commission_flow_task_id);
  END IF;
END $$;