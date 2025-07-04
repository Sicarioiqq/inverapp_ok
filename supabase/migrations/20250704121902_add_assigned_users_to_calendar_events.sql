/*
  # Add automatic calendar event creation for task assignments

  1. Changes
    - Add assigned_to column to calendar_events table
    - Create trigger to automatically create calendar events when tasks are assigned
    - Update calendar events query to show events assigned to the user
    - Add RLS policies for assigned_to column

  2. Security
    - Users can see events assigned to them
    - Maintain existing created_by policies
*/

-- Add assigned_to column to calendar_events table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calendar_events' 
    AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE calendar_events 
    ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for assigned_to
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to 
ON calendar_events(assigned_to);

-- Create function to handle automatic calendar event creation for task assignments
CREATE OR REPLACE FUNCTION handle_task_assignment_calendar_event()
RETURNS trigger AS $$
DECLARE
  v_task_name text;
  v_reservation_number text;
  v_project_name text;
  v_apartment_number text;
  v_client_name text;
  v_event_title text;
  v_event_description text;
  v_assigned_user_id uuid;
BEGIN
  -- Only create calendar event for new assignments
  IF TG_OP = 'INSERT' THEN
    -- Get task information
    SELECT 
      t.name,
      r.reservation_number,
      p.name,
      r.apartment_number,
      CONCAT(c.first_name, ' ', c.last_name)
    INTO 
      v_task_name,
      v_reservation_number,
      v_project_name,
      v_apartment_number,
      v_client_name
    FROM sale_flow_tasks t
    JOIN reservation_flows rf ON rf.id = NEW.reservation_flow_id
    JOIN reservations r ON r.id = rf.reservation_id
    JOIN projects p ON p.id = r.project_id
    JOIN clients c ON c.id = r.client_id
    WHERE t.id = NEW.task_id;

    -- Set assigned user
    v_assigned_user_id := NEW.user_id;

    -- Create event title and description
    v_event_title := v_task_name;
    v_event_description := CONCAT(
      'Reserva: ', v_reservation_number, E'\n',
      'Proyecto: ', v_project_name, E'\n',
      'Unidad: ', v_apartment_number, E'\n',
      'Cliente: ', v_client_name
    );

    -- Create calendar event for the assigned user
    INSERT INTO calendar_events (
      title,
      description,
      type,
      start,
      created_by,
      assigned_to,
      reservation_flow_id,
      reservation_flow_task_id
    ) VALUES (
      v_event_title,
      v_event_description,
      'gestion',
      CURRENT_DATE,
      NEW.assigned_by,
      v_assigned_user_id,
      NEW.reservation_flow_id,
      (SELECT id FROM reservation_flow_tasks 
       WHERE reservation_flow_id = NEW.reservation_flow_id 
       AND task_id = NEW.task_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic calendar event creation
DROP TRIGGER IF EXISTS on_task_assignment_calendar_event ON task_assignments;
CREATE TRIGGER on_task_assignment_calendar_event
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_assignment_calendar_event();

-- Update RLS policies for calendar_events to include assigned_to
DROP POLICY IF EXISTS "Users can view their own calendar events" ON calendar_events;
CREATE POLICY "Users can view their own calendar events" ON calendar_events
  FOR SELECT USING (
    auth.uid() = created_by OR 
    auth.uid() = assigned_to
  );

-- Add policy for users to view events assigned to them
CREATE POLICY "Users can view events assigned to them" ON calendar_events
  FOR SELECT USING (auth.uid() = assigned_to);

-- Update the existing policies to work with assigned_to
DROP POLICY IF EXISTS "Users can insert their own calendar events" ON calendar_events;
CREATE POLICY "Users can insert their own calendar events" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own calendar events" ON calendar_events;
CREATE POLICY "Users can update their own calendar events" ON calendar_events
  FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own calendar events" ON calendar_events;
CREATE POLICY "Users can delete their own calendar events" ON calendar_events
  FOR DELETE USING (auth.uid() = created_by);
