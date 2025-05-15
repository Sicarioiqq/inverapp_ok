/*
  # Reset payment flows to pending state

  1. Changes
    - Update all commission flows to pending status
    - Clear started_at and completed_at dates
    - Reset task statuses and dates
    - Maintain data integrity
*/

-- First, update all commission flow tasks
UPDATE commission_flow_tasks
SET 
  status = 'pending',
  started_at = NULL,
  completed_at = NULL,
  assigned_at = NULL,
  assignee_id = NULL;

-- Then update all commission flows
UPDATE commission_flows
SET 
  status = 'pending',
  started_at = now(), -- Keep a reference date
  completed_at = NULL,
  current_stage_id = (
    SELECT id 
    FROM payment_flow_stages 
    WHERE flow_id = commission_flows.flow_id 
    ORDER BY "order" ASC 
    LIMIT 1
  );

-- Delete any existing comments
DELETE FROM commission_task_comments;