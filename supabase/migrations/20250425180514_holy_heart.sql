/*
  # Add KAM permissions for task management and bank information

  1. Changes
    - Update RLS policies to allow KAM users to assign users to tasks
    - Update RLS policies to allow KAM users to complete tasks in reservation flows
    - Update RLS policies to allow KAM users to edit bank information
    
  2. Security
    - Maintain existing RLS policies for other user types
    - Ensure proper access control
*/

-- Update handle_task_status_change function to allow KAM users to complete tasks
CREATE OR REPLACE FUNCTION handle_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_is_admin boolean;
  v_is_kam boolean;
BEGIN
  -- Check if user is admin or KAM
  SELECT 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    ),
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'KAM'
    )
  INTO v_is_admin, v_is_kam;

  -- Task being completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Set completion date
    NEW.completed_at = now();
    
    -- Clear assignee when task is completed
    NEW.assignee_id = NULL;
    
    -- Remove all task assignments
    DELETE FROM task_assignments
    WHERE reservation_flow_id = NEW.reservation_flow_id
    AND task_id = NEW.task_id;
  
  -- Task being uncompleted
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    IF NOT (v_is_admin OR v_is_kam) THEN
      RAISE EXCEPTION 'Solo los administradores o KAM pueden modificar tareas completadas';
    END IF;
    NEW.completed_at = NULL;
  
  -- Completed date being modified directly
  ELSIF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    IF NOT (v_is_admin OR v_is_kam) THEN
      RAISE EXCEPTION 'Solo los administradores o KAM pueden modificar la fecha de completado';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update handle_commission_task_status_change function to allow KAM users to complete tasks
CREATE OR REPLACE FUNCTION handle_commission_task_status_change()
RETURNS trigger AS $$
DECLARE
  v_is_admin boolean;
  v_is_kam boolean;
  v_flow_status text;
  v_stage_order int;
  v_task_order int;
  v_prev_task_completed boolean;
  v_prev_stage_completed boolean;
  v_default_assignee_id uuid;
  v_task_name text;
  v_stage_name text;
  v_prev_task_name text;
BEGIN
  -- Check if user is admin or KAM
  SELECT 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'Administrador'
    ),
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type = 'KAM'
    )
  INTO v_is_admin, v_is_kam;

  -- Allow admins and KAM to modify dates directly
  IF (v_is_admin OR v_is_kam) AND (
    NEW.started_at IS DISTINCT FROM OLD.started_at OR
    NEW.completed_at IS DISTINCT FROM OLD.completed_at
  ) THEN
    RETURN NEW;
  END IF;

  -- Get flow status and task order information
  SELECT 
    cf.status,
    pfs."order",
    pft."order",
    pft.default_assignee_id,
    pft.name,
    pfs.name
  INTO 
    v_flow_status,
    v_stage_order,
    v_task_order,
    v_default_assignee_id,
    v_task_name,
    v_stage_name
  FROM commission_flows cf
  JOIN payment_flow_stages pfs ON pfs.id = cf.current_stage_id
  JOIN payment_flow_tasks pft ON pft.stage_id = pfs.id AND pft.id = NEW.task_id
  WHERE cf.id = NEW.commission_flow_id;

  -- Check if flow is pending
  IF v_flow_status = 'pending' THEN
    RAISE EXCEPTION 'No se pueden modificar tareas mientras el flujo esté pendiente';
  END IF;

  -- Skip task order validation for admins and KAM
  IF NOT (v_is_admin OR v_is_kam) THEN
    -- Special case for VB Control de Gestión - check if Solicitud Control de Gestión is completed
    IF v_stage_name = 'Aprobación Control de Gestión' AND v_task_name = 'VB Control de Gestión' THEN
      -- Check if Solicitud Control de Gestión is completed
      SELECT EXISTS (
        SELECT 1
        FROM commission_flow_tasks cft
        JOIN payment_flow_tasks pft ON pft.id = cft.task_id
        JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
        WHERE cft.commission_flow_id = NEW.commission_flow_id
        AND pfs.name = 'Aprobación Control de Gestión'
        AND pft.name = 'Solicitud Control de Gestión'
        AND cft.status = 'completed'
      ) INTO v_prev_task_completed;

      IF NOT v_prev_task_completed AND NEW.status != 'blocked' THEN
        RAISE EXCEPTION 'No se puede modificar esta tarea hasta que se complete la tarea anterior';
      END IF;
    -- Special case for other VB tasks - check if corresponding Solicitud task is completed
    ELSIF v_task_name LIKE 'VB%' THEN
      -- Get the corresponding Solicitud task name
      SELECT name INTO v_prev_task_name
      FROM payment_flow_tasks
      WHERE stage_id = (SELECT stage_id FROM payment_flow_tasks WHERE id = NEW.task_id)
      AND name LIKE 'Solicitud%'
      LIMIT 1;
      
      IF v_prev_task_name IS NOT NULL THEN
        -- Check if the Solicitud task is completed
        SELECT EXISTS (
          SELECT 1
          FROM commission_flow_tasks cft
          JOIN payment_flow_tasks pft ON pft.id = cft.task_id
          WHERE cft.commission_flow_id = NEW.commission_flow_id
          AND pft.name = v_prev_task_name
          AND cft.status = 'completed'
        ) INTO v_prev_task_completed;

        IF NOT v_prev_task_completed AND NEW.status != 'blocked' THEN
          RAISE EXCEPTION 'No se puede modificar esta tarea hasta que se complete la tarea anterior';
        END IF;
      ELSE
        -- Check previous task completion if not first task
        IF v_task_order > 1 THEN
          SELECT EXISTS (
            SELECT 1
            FROM commission_flow_tasks cft
            JOIN payment_flow_tasks pft ON pft.id = cft.task_id
            WHERE cft.commission_flow_id = NEW.commission_flow_id
            AND pft.stage_id = (SELECT stage_id FROM payment_flow_tasks WHERE id = NEW.task_id)
            AND pft."order" = v_task_order - 1
            AND cft.status = 'completed'
          ) INTO v_prev_task_completed;

          IF NOT v_prev_task_completed AND NEW.status != 'blocked' THEN
            RAISE EXCEPTION 'No se puede modificar esta tarea hasta que se complete la tarea anterior';
          END IF;
        END IF;
      END IF;
    -- Regular case - check previous task completion if not first task
    ELSIF v_task_order > 1 THEN
      SELECT EXISTS (
        SELECT 1
        FROM commission_flow_tasks cft
        JOIN payment_flow_tasks pft ON pft.id = cft.task_id
        WHERE cft.commission_flow_id = NEW.commission_flow_id
        AND pft.stage_id = (SELECT stage_id FROM payment_flow_tasks WHERE id = NEW.task_id)
        AND pft."order" = v_task_order - 1
        AND cft.status = 'completed'
      ) INTO v_prev_task_completed;

      IF NOT v_prev_task_completed AND NEW.status != 'blocked' THEN
        RAISE EXCEPTION 'No se puede modificar esta tarea hasta que se complete la tarea anterior';
      END IF;
    END IF;

    -- Check previous stage completion if not first stage
    IF v_stage_order > 1 THEN
      SELECT EXISTS (
        SELECT 1
        FROM commission_flow_tasks cft
        JOIN payment_flow_tasks pft ON pft.id = cft.task_id
        JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
        WHERE cft.commission_flow_id = NEW.commission_flow_id
        AND pfs."order" = v_stage_order - 1
        AND cft.status = 'completed'
      ) INTO v_prev_stage_completed;

      IF NOT v_prev_stage_completed AND NEW.status != 'blocked' THEN
        RAISE EXCEPTION 'No se puede modificar esta tarea hasta que se complete la etapa anterior';
      END IF;
    END IF;
  END IF;

  -- Set started_at when task is first assigned or status changes from pending
  IF (OLD.status = 'pending' OR OLD.status IS NULL) AND NEW.status != 'pending' THEN
    NEW.started_at = COALESCE(NEW.started_at, now());
  END IF;

  -- Handle task completion
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = COALESCE(NEW.completed_at, now());
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    IF NOT (v_is_admin OR v_is_kam) THEN
      RAISE EXCEPTION 'Solo los administradores o KAM pueden modificar tareas completadas';
    END IF;
    NEW.completed_at = NULL;
  END IF;

  -- Assign default user if not already assigned
  IF NEW.assignee_id IS NULL AND v_default_assignee_id IS NOT NULL THEN
    NEW.assignee_id = v_default_assignee_id;
    NEW.assigned_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update task_assignments policies to allow KAM users to assign tasks
DROP POLICY IF EXISTS "Vendedores y admins pueden crear asignaciones" ON task_assignments;
CREATE POLICY "Vendedores, KAM y admins pueden crear asignaciones"
  ON task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR p.user_type = 'KAM'
        OR (p.is_seller = true)
      )
    )
  );

DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar asignaciones" ON task_assignments;
CREATE POLICY "Vendedores, KAM y admins pueden actualizar asignaciones"
  ON task_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR p.user_type = 'KAM'
        OR (p.is_seller = true)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR p.user_type = 'KAM'
        OR (p.is_seller = true)
      )
    )
  );

-- Update reservation_flow_tasks policies to allow KAM users to update tasks
DROP POLICY IF EXISTS "Administradores pueden gestionar todas las tareas y vendedores solo las no completadas" ON reservation_flow_tasks;
CREATE POLICY "Administradores y KAM pueden gestionar todas las tareas y vendedores solo las no completadas"
  ON reservation_flow_tasks FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR 
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND user_type = 'KAM'
      )
    ) OR 
    (
      status != 'completed' AND
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN reservations r ON r.seller_id = p.id
        JOIN reservation_flows rf ON rf.reservation_id = r.id
        WHERE p.id = auth.uid()
        AND rf.id = reservation_flow_id
        AND p.is_seller = true
      )
    )
  )
  WITH CHECK (
    is_admin() OR 
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND user_type = 'KAM'
      )
    ) OR 
    (
      status != 'completed' AND
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN reservations r ON r.seller_id = p.id
        JOIN reservation_flows rf ON rf.reservation_id = r.id
        WHERE p.id = auth.uid()
        AND rf.id = reservation_flow_id
        AND p.is_seller = true
      )
    )
  );

-- Update reservations policies to allow KAM users to update bank information
DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar reservas" ON reservations;
CREATE POLICY "Vendedores, KAM y admins pueden actualizar reservas"
  ON reservations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        user_type = 'Administrador'
        OR user_type = 'KAM'
        OR (is_seller = true AND id = seller_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        user_type = 'Administrador'
        OR user_type = 'KAM'
        OR (is_seller = true AND id = seller_id)
      )
    )
  );

-- Update task_comments policies to allow KAM users to create and update comments
DROP POLICY IF EXISTS "Vendedores y admins pueden crear comentarios" ON task_comments;
CREATE POLICY "Vendedores, KAM y admins pueden crear comentarios"
  ON task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR p.user_type = 'KAM'
        OR (p.is_seller = true)
      )
    )
  );

DROP POLICY IF EXISTS "Vendedores y admins pueden actualizar comentarios" ON task_comments;
CREATE POLICY "Vendedores, KAM y admins pueden actualizar comentarios"
  ON task_comments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR p.user_type = 'KAM'
        OR (p.is_seller = true)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND (
        p.user_type = 'Administrador'
        OR p.user_type = 'KAM'
        OR (p.is_seller = true)
      )
    )
  );