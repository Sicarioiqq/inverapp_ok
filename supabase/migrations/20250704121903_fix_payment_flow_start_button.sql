/*
  # Fix Payment Flow Start Button Issue

  1. Problem
    - The "Proceder con Pago" button is not starting the flow
    - This is likely due to RLS policies blocking the update
    - Similar to the task status change issue we had before

  2. Solution
    - Update RLS policies for commission_flows to allow proper updates
    - Ensure the handle_flow_status_change trigger works correctly
    - Add proper error handling and logging
    - Fix any potential issues with the trigger function

  3. Security
    - Maintain existing security while fixing the functionality
    - Ensure only authorized users can start flows
*/

-- First, let's check and fix the RLS policies for commission_flows
DROP POLICY IF EXISTS "Administradores pueden gestionar flujos y vendedores pueden actualizar sus flujos" ON commission_flows;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar flujos de comisión" ON commission_flows;

-- Create a more permissive policy for updating commission_flows
CREATE POLICY "Usuarios autenticados pueden actualizar flujos de comisión"
  ON commission_flows FOR UPDATE
  TO authenticated
  USING (
    -- Allow admins to update any flow
    is_admin() OR
    -- Allow users to update flows related to their reservations
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN broker_commissions bc ON bc.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND bc.id = commission_flows.broker_commission_id
    ) OR
    -- Allow users to update flows where they are assigned to tasks
    EXISTS (
      SELECT 1 FROM commission_flow_tasks cft
      WHERE cft.commission_flow_id = commission_flows.id
      AND cft.assignee_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Allow admins to update any flow
    is_admin() OR
    -- Allow users to update flows related to their reservations
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN reservations r ON r.seller_id = p.id
      JOIN broker_commissions bc ON bc.reservation_id = r.id
      WHERE p.id = auth.uid()
      AND bc.id = commission_flows.broker_commission_id
    ) OR
    -- Allow users to update flows where they are assigned to tasks
    EXISTS (
      SELECT 1 FROM commission_flow_tasks cft
      WHERE cft.commission_flow_id = commission_flows.id
      AND cft.assignee_id = auth.uid()
    )
  );

-- Update the handle_flow_status_change function to be more robust
CREATE OR REPLACE FUNCTION handle_flow_status_change()
RETURNS trigger AS $$
DECLARE
  v_first_task_id uuid;
  v_first_task_assignee_id uuid;
  v_error_message text;
BEGIN
  -- Add logging for debugging
  RAISE LOG 'handle_flow_status_change: Flow % status changed from % to %', 
    NEW.id, OLD.status, NEW.status;

  -- Only handle changes from pending to in_progress
  IF NEW.status = 'in_progress' AND OLD.status = 'pending' THEN
    RAISE LOG 'handle_flow_status_change: Processing status change to in_progress';
    
    -- Get the first task and its default assignee
    SELECT t.id, t.default_assignee_id 
    INTO v_first_task_id, v_first_task_assignee_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = NEW.flow_id
    AND s."order" = 1
    AND t."order" = 1;

    RAISE LOG 'handle_flow_status_change: First task ID: %, Default assignee: %', 
      v_first_task_id, v_first_task_assignee_id;

    -- Update the first task to pending and assign default user
    UPDATE commission_flow_tasks
    SET 
      status = 'pending',
      assignee_id = v_first_task_assignee_id,
      assigned_at = CASE 
        WHEN v_first_task_assignee_id IS NOT NULL THEN now()
        ELSE NULL
      END,
      started_at = NEW.started_at -- Use the flow start date
    WHERE commission_flow_id = NEW.id
    AND task_id = v_first_task_id
    AND status = 'blocked'; -- Only update if task is blocked

    RAISE LOG 'handle_flow_status_change: Updated first task successfully';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    v_error_message := 'Error in handle_flow_status_change: ' || SQLERRM;
    RAISE LOG '%', v_error_message;
    
    -- Re-raise the error
    RAISE EXCEPTION '%', v_error_message;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger to ensure it's properly set up
DROP TRIGGER IF EXISTS on_commission_flow_status_change ON commission_flows;
CREATE TRIGGER on_commission_flow_status_change
  AFTER UPDATE OF status ON commission_flows
  FOR EACH ROW
  EXECUTE FUNCTION handle_flow_status_change();

-- Add a function to help debug flow status issues
CREATE OR REPLACE FUNCTION debug_commission_flow(flow_id uuid)
RETURNS TABLE(
  flow_status text,
  flow_started_at timestamptz,
  task_count integer,
  pending_tasks integer,
  blocked_tasks integer,
  completed_tasks integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cf.status as flow_status,
    cf.started_at as flow_started_at,
    COUNT(cft.id) as task_count,
    COUNT(CASE WHEN cft.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN cft.status = 'blocked' THEN 1 END) as blocked_tasks,
    COUNT(CASE WHEN cft.status = 'completed' THEN 1 END) as completed_tasks
  FROM commission_flows cf
  LEFT JOIN commission_flow_tasks cft ON cft.commission_flow_id = cf.id
  WHERE cf.id = flow_id
  GROUP BY cf.status, cf.started_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix any existing flows that might be stuck in pending state
DO $$
DECLARE
  v_flow record;
  v_first_task_id uuid;
  v_first_task_assignee_id uuid;
BEGIN
  -- For each pending flow that has started_at set
  FOR v_flow IN 
    SELECT * FROM commission_flows 
    WHERE status = 'pending' 
    AND started_at IS NOT NULL
  LOOP
    RAISE LOG 'Fixing stuck flow: %', v_flow.id;
    
    -- Get first task info
    SELECT t.id, t.default_assignee_id 
    INTO v_first_task_id, v_first_task_assignee_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = v_flow.flow_id
    AND s."order" = 1
    AND t."order" = 1;

    -- Update the first task to pending
    UPDATE commission_flow_tasks
    SET 
      status = 'pending',
      assignee_id = v_first_task_assignee_id,
      assigned_at = CASE 
        WHEN v_first_task_assignee_id IS NOT NULL THEN now()
        ELSE NULL
      END,
      started_at = v_flow.started_at
    WHERE commission_flow_id = v_flow.id
    AND task_id = v_first_task_id;
  END LOOP;
END $$; 