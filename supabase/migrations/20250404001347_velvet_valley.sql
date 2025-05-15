/*
  # Fix default assignees in payment flow tasks

  1. Changes
    - Update initialize_commission_flow function to properly assign default users
    - Update handle_task_completion function to ensure next tasks get default assignees
    - Fix existing tasks to have proper default assignees
    
  2. Security
    - Maintain existing RLS policies
*/

-- Temporarily disable the trigger that enforces validation
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

-- Update initialize_commission_flow function to properly assign default users
CREATE OR REPLACE FUNCTION initialize_commission_flow()
RETURNS TRIGGER AS $$
DECLARE
  v_task record;
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

  -- Insert all tasks with proper status, assignments and default assignees
  FOR v_task IN (
    SELECT 
      t.id as task_id,
      t.default_assignee_id,
      s."order" as stage_order,
      t."order" as task_order,
      s.id as stage_id
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = NEW.flow_id
    ORDER BY s."order", t."order"
  ) LOOP
    -- Insert the task
    INSERT INTO commission_flow_tasks (
      commission_flow_id,
      task_id,
      status,
      started_at,
      completed_at,
      assigned_at,
      assignee_id
    )
    VALUES (
      NEW.id,
      v_task.task_id,
      CASE 
        WHEN NEW.status = 'in_progress' AND v_task.stage_order = 1 AND v_task.task_order = 1 THEN 'pending'
        ELSE 'blocked'
      END,
      CASE
        WHEN NEW.status = 'in_progress' AND v_task.stage_order = 1 AND v_task.task_order = 1 THEN NEW.started_at
        ELSE NULL
      END,
      NULL,
      CASE 
        WHEN NEW.status = 'in_progress' AND v_task.stage_order = 1 AND v_task.task_order = 1 AND v_task.default_assignee_id IS NOT NULL 
        THEN now()
        ELSE NULL
      END,
      CASE 
        WHEN NEW.status = 'in_progress' AND v_task.stage_order = 1 AND v_task.task_order = 1 
        THEN v_task.default_assignee_id
        ELSE NULL
      END
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update handle_task_completion function to ensure next tasks get default assignees
CREATE OR REPLACE FUNCTION handle_task_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_flow_id uuid;
  v_current_stage_order integer;
  v_current_task_order integer;
  v_next_task record;
  v_is_last_task boolean;
  v_all_tasks_completed boolean;
BEGIN
  -- Only proceed if task is being completed or completion date changed
  IF (NEW.status = 'completed' AND OLD.status != 'completed') OR 
     (NEW.status = 'completed' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at) THEN
    
    -- Get current task position and flow ID
    SELECT 
      f.flow_id,
      s."order",
      t."order"
    INTO 
      v_flow_id,
      v_current_stage_order,
      v_current_task_order
    FROM commission_flows f
    JOIN payment_flow_stages s ON s.id = f.current_stage_id
    JOIN payment_flow_tasks t ON t.id = NEW.task_id
    WHERE f.id = NEW.commission_flow_id;

    -- Get next task with default assignee
    SELECT 
      t.id as task_id,
      s.id as stage_id,
      s."order" as stage_order,
      t."order" as task_order,
      t.default_assignee_id
    INTO v_next_task
    FROM payment_flow_stages s
    JOIN payment_flow_tasks t ON t.stage_id = s.id
    WHERE s.flow_id = v_flow_id
    AND (
      (s."order" = v_current_stage_order AND t."order" > v_current_task_order) OR
      (s."order" > v_current_stage_order AND t."order" = 1)
    )
    ORDER BY s."order", t."order"
    LIMIT 1;

    -- If there is a next task, set it up
    IF v_next_task IS NOT NULL THEN
      -- Update flow's current stage if needed
      IF v_next_task.stage_order > v_current_stage_order THEN
        UPDATE commission_flows
        SET current_stage_id = v_next_task.stage_id
        WHERE id = NEW.commission_flow_id;
      END IF;

      -- Set next task to pending and assign default user
      UPDATE commission_flow_tasks
      SET 
        status = 'pending',
        assignee_id = v_next_task.default_assignee_id,
        assigned_at = CASE 
          WHEN v_next_task.default_assignee_id IS NOT NULL THEN now()
          ELSE NULL
        END,
        started_at = NEW.completed_at, -- Use the completion date of the current task as the start date
        completed_at = NULL
      WHERE commission_flow_id = NEW.commission_flow_id
      AND task_id = v_next_task.task_id;

    ELSE
      -- Check if this is the last task
      SELECT is_last_payment_task(NEW.task_id) INTO v_is_last_task;
      
      -- Check if all tasks are completed
      SELECT NOT EXISTS (
        SELECT 1 
        FROM commission_flow_tasks 
        WHERE commission_flow_id = NEW.commission_flow_id 
        AND status != 'completed'
      ) INTO v_all_tasks_completed;

      -- If this is the last task and all tasks are completed, complete the flow
      IF v_is_last_task AND v_all_tasks_completed THEN
        UPDATE commission_flows
        SET 
          status = 'completed',
          completed_at = now()
        WHERE id = NEW.commission_flow_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix existing tasks to have proper default assignees
DO $$
DECLARE
  v_flow record;
  v_task record;
BEGIN
  -- For each commission flow
  FOR v_flow IN 
    SELECT cf.id, cf.flow_id, cf.status
    FROM commission_flows cf
    WHERE cf.status = 'in_progress'
  LOOP
    -- For each task in the flow
    FOR v_task IN
      SELECT 
        cft.id as flow_task_id,
        cft.task_id,
        cft.status,
        pft.default_assignee_id,
        pfs."order" as stage_order,
        pft."order" as task_order
      FROM commission_flow_tasks cft
      JOIN payment_flow_tasks pft ON pft.id = cft.task_id
      JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
      WHERE cft.commission_flow_id = v_flow.id
      AND cft.status IN ('pending', 'in_progress')
      AND cft.assignee_id IS NULL
      AND pft.default_assignee_id IS NOT NULL
      ORDER BY pfs."order", pft."order"
    LOOP
      -- Update the task with its default assignee
      UPDATE commission_flow_tasks
      SET 
        assignee_id = v_task.default_assignee_id,
        assigned_at = now()
      WHERE id = v_task.flow_task_id;
    END LOOP;
  END LOOP;
END $$;

-- Re-enable the trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;