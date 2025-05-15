/*
  # Populate operations table with existing reservations

  1. Changes
    - Insert a record in operations for each existing reservation
    - Set default values for required fields
    - Maintain data integrity with proper foreign key relationships

  2. Notes
    - All operations will start with null status
    - Bank and executive information will need to be updated later
*/

DO $$
DECLARE
  v_reservation RECORD;
  v_admin_id uuid;
BEGIN
  -- Get an admin user ID for created_by/updated_by
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE user_type = 'Administrador'
  LIMIT 1;

  -- Insert operations for each reservation that doesn't have one
  FOR v_reservation IN (
    SELECT r.id
    FROM reservations r
    LEFT JOIN operations o ON o.reservation_id = r.id
    WHERE o.id IS NULL
  )
  LOOP
    INSERT INTO operations (
      reservation_id,
      bank,
      executive,
      executive_email,
      executive_phone,
      approval_amount,
      credit_amount,
      created_by,
      updated_by
    )
    VALUES (
      v_reservation.id,
      '', -- Empty bank name
      '', -- Empty executive name
      NULL, -- No email
      NULL, -- No phone
      0, -- No approval amount yet
      0, -- No credit amount yet
      v_admin_id,
      v_admin_id
    );
  END LOOP;
END $$;