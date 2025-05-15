/*
  # Add RLS policies for commission flows

  1. Changes
    - Add INSERT and UPDATE policies for commission_flows
    - Add INSERT and UPDATE policies for commission_flow_tasks
    - Add UPDATE policy for payment_flow_tasks
    - Ensure proper access control for all operations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver flujos de comisión" ON commission_flows;
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver tareas de comisión" ON commission_flow_tasks;

-- Create policies for commission_flows
CREATE POLICY "Usuarios autenticados pueden ver flujos de comisión"
  ON commission_flows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear flujos de comisión"
  ON commission_flows FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar flujos de comisión"
  ON commission_flows FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for commission_flow_tasks
CREATE POLICY "Usuarios autenticados pueden ver tareas de comisión"
  ON commission_flow_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear tareas de comisión"
  ON commission_flow_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar tareas de comisión"
  ON commission_flow_tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add policy for updating payment_flow_tasks
CREATE POLICY "Usuarios autenticados pueden actualizar tareas de flujo"
  ON payment_flow_tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);