-- Update initialize_commission_flow function to properly handle duplicates
CREATE OR REPLACE FUNCTION initialize_commission_flow()
RETURNS trigger AS $$
DECLARE
  v_first_task_id uuid;
  v_existing_task_count integer;
BEGIN
  -- First check if tasks already exist for this flow
  SELECT COUNT(*) INTO v_existing_task_count
  FROM commission_flow_tasks
  WHERE commission_flow_id = NEW.id;

  -- If tasks already exist, exit early
  IF v_existing_task_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Get first task of the flow
  SELECT t.id INTO v_first_task_id
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ORDER BY s."order", t."order"
  LIMIT 1;

  -- Insert all tasks at once with proper status
  INSERT INTO commission_flow_tasks (
    commission_flow_id,
    task_id,
    status,
    started_at,
    completed_at,
    assigned_at,
    assignee_id
  )
  SELECT 
    NEW.id,
    t.id,
    CASE 
      WHEN NEW.status = 'in_progress' AND t.id = v_first_task_id THEN 'pending'
      ELSE 'blocked'
    END,
    NULL,
    NULL,
    NULL,
    NULL
  FROM payment_flow_stages s
  JOIN payment_flow_tasks t ON t.stage_id = s.id
  WHERE s.flow_id = NEW.flow_id
  ON CONFLICT (commission_flow_id, task_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;