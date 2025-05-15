DO $$
DECLARE
  v_flow_id uuid;
  v_stage_id uuid;
BEGIN
  -- Check if default flows already exist
  IF NOT EXISTS (SELECT 1 FROM payment_flows WHERE name = 'Flujo de Pago Principal') THEN
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
  END IF;

  -- Check if second payment flow exists
  IF NOT EXISTS (SELECT 1 FROM payment_flows WHERE name = 'Flujo de Segundo Pago') THEN
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
  END IF;
END $$;