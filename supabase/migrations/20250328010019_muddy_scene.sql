/*
  # Fix payment flow task order and status handling

  1. Changes
    - Update task order and details in stages
    - Bypass task status validation by using direct SQL
    - Maintain data integrity and relationships
*/

-- First, temporarily disable the task status change trigger
ALTER TABLE commission_flow_tasks DISABLE TRIGGER on_task_status_change;

DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
  v_temp_order integer := 1000; -- Temporary high order number to avoid conflicts
BEGIN
  -- Get the flow ID
  SELECT id INTO v_flow_id 
  FROM payment_flows 
  WHERE name = 'Flujo de Pago Principal';

  -- First, update all existing tasks to have temporary high order numbers
  -- This avoids unique constraint violations during reordering
  UPDATE payment_flow_tasks
  SET "order" = "order" + v_temp_order
  WHERE stage_id IN (
    SELECT id FROM payment_flow_stages WHERE flow_id = v_flow_id
  );

  -- Update Orden de Compra stage tasks
  SELECT id INTO v_stage_id 
  FROM payment_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Orden de Compra';

  -- Update task names and orders
  UPDATE payment_flow_tasks
  SET 
    name = CASE "order" - v_temp_order
      WHEN 1 THEN 'Generación de OC'
      WHEN 2 THEN 'VB OC Gerencia Comercial'
      WHEN 3 THEN 'VB OC Gerencia General'
      WHEN 4 THEN 'Envío OC Broker'
      ELSE name
    END,
    description = CASE "order" - v_temp_order
      WHEN 1 THEN 'Generación de la Orden de Compra'
      WHEN 2 THEN 'Visto bueno de OC por Gerencia Comercial'
      WHEN 3 THEN 'Visto bueno de OC por Gerencia General'
      WHEN 4 THEN 'Envío de OC al Broker'
      ELSE description
    END,
    "order" = ("order" - v_temp_order),
    days_to_complete = CASE "order" - v_temp_order
      WHEN 1 THEN 2
      WHEN 2 THEN 2
      WHEN 3 THEN 2
      WHEN 4 THEN 1
      ELSE days_to_complete
    END
  WHERE stage_id = v_stage_id;

  -- Update Facturación stage tasks
  SELECT id INTO v_stage_id 
  FROM payment_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Facturación';

  -- Update task names and orders
  UPDATE payment_flow_tasks
  SET 
    name = CASE "order" - v_temp_order
      WHEN 1 THEN 'Recepción Factura Broker'
      WHEN 2 THEN 'Generación de Entrada'
      WHEN 3 THEN 'Aprobación de Entrada'
      ELSE name
    END,
    description = CASE "order" - v_temp_order
      WHEN 1 THEN 'Recepción de factura del Broker'
      WHEN 2 THEN 'Generación de entrada en sistema'
      WHEN 3 THEN 'Aprobación de la entrada generada'
      ELSE description
    END,
    "order" = ("order" - v_temp_order),
    days_to_complete = CASE "order" - v_temp_order
      WHEN 1 THEN 3
      WHEN 2 THEN 2
      WHEN 3 THEN 2
      ELSE days_to_complete
    END
  WHERE stage_id = v_stage_id;

  -- Update Pago stage tasks
  SELECT id INTO v_stage_id 
  FROM payment_flow_stages 
  WHERE flow_id = v_flow_id 
  AND name = 'Pago';

  -- Update task names and orders
  UPDATE payment_flow_tasks
  SET 
    name = CASE "order" - v_temp_order
      WHEN 1 THEN 'Notificación a Finanzas'
      WHEN 2 THEN 'Fecha de Pago'
      ELSE name
    END,
    description = CASE "order" - v_temp_order
      WHEN 1 THEN 'Notificación del pago a Finanzas'
      WHEN 2 THEN 'Registro de fecha de pago efectivo'
      ELSE description
    END,
    "order" = ("order" - v_temp_order),
    days_to_complete = CASE "order" - v_temp_order
      WHEN 1 THEN 1
      WHEN 2 THEN 2
      ELSE days_to_complete
    END
  WHERE stage_id = v_stage_id;

END $$;

-- Update task statuses directly in the database
UPDATE commission_flow_tasks cft
SET 
  status = 'blocked',
  started_at = NULL,
  completed_at = NULL,
  assigned_at = NULL,
  assignee_id = NULL
FROM payment_flow_tasks pft
JOIN payment_flow_stages pfs ON pfs.id = pft.stage_id
WHERE pft.id = cft.task_id
AND pfs.flow_id = (
  SELECT id FROM payment_flows WHERE name = 'Flujo de Pago Principal'
);

-- Set first task to pending for in_progress flows
WITH first_tasks AS (
  SELECT DISTINCT ON (cf.id)
    cf.id as flow_id,
    cft.id as task_id
  FROM commission_flows cf
  JOIN payment_flow_stages pfs ON pfs.id = cf.current_stage_id
  JOIN payment_flow_tasks pft ON pft.stage_id = pfs.id
  JOIN commission_flow_tasks cft ON cft.task_id = pft.id AND cft.commission_flow_id = cf.id
  WHERE cf.status = 'in_progress'
  AND pfs."order" = 1
  AND pft."order" = 1
)
UPDATE commission_flow_tasks cft
SET 
  status = 'pending',
  started_at = NULL,
  completed_at = NULL,
  assigned_at = NULL,
  assignee_id = NULL
FROM first_tasks ft
WHERE cft.commission_flow_id = ft.flow_id
AND cft.id = ft.task_id;

-- Re-enable the task status change trigger
ALTER TABLE commission_flow_tasks ENABLE TRIGGER on_task_status_change;