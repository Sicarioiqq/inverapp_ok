/*
  # Add Client Document Verification Schema

  1. New Tables
    - `client_documents`
      - `id` (uuid, primary key)
      - `reservation_id` (uuid) - Reference to reservation
      - `document_type` (text) - Type of document (CMF, AFP, etc.)
      - `is_received` (boolean) - Whether document has been received
      - `received_at` (timestamptz) - When document was received
      - `notes` (text) - Optional notes about the document
      - Audit fields (created_at, updated_at, created_by, updated_by)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create client_documents table
CREATE TABLE IF NOT EXISTS client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL,
  is_received boolean NOT NULL DEFAULT false,
  received_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS client_documents_reservation_id_idx ON client_documents(reservation_id);
CREATE INDEX IF NOT EXISTS client_documents_document_type_idx ON client_documents(document_type);
CREATE UNIQUE INDEX IF NOT EXISTS client_documents_reservation_id_document_type_idx ON client_documents(reservation_id, document_type);

-- Enable RLS
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Usuarios autenticados pueden ver documentos de cliente"
  ON client_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden crear documentos de cliente"
  ON client_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar documentos de cliente"
  ON client_documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger for updating updated_at
CREATE TRIGGER update_client_documents_updated_at
  BEFORE UPDATE ON client_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create function to handle document status changes
CREATE OR REPLACE FUNCTION handle_document_status_change()
RETURNS trigger AS $$
BEGIN
  -- If document is being marked as received, set received_at
  IF NEW.is_received = true AND (OLD.is_received = false OR OLD.is_received IS NULL) THEN
    NEW.received_at = now();
  -- If document is being marked as not received, clear received_at
  ELSIF NEW.is_received = false AND OLD.is_received = true THEN
    NEW.received_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document status changes
CREATE TRIGGER on_document_status_change
  BEFORE UPDATE OF is_received ON client_documents
  FOR EACH ROW
  EXECUTE FUNCTION handle_document_status_change();

-- Insert default document types for existing reservations
DO $$
DECLARE
  v_reservation record;
  v_document_types text[] := ARRAY['CMF', 'LIQUIDACIONES', 'AFP', 'ONU', 'NO_DOCS'];
  v_document_type text;
BEGIN
  -- For each reservation
  FOR v_reservation IN 
    SELECT id FROM reservations
  LOOP
    -- For each document type
    FOREACH v_document_type IN ARRAY v_document_types
    LOOP
      -- Insert document record if it doesn't exist
      INSERT INTO client_documents (
        reservation_id,
        document_type,
        is_received,
        notes
      )
      VALUES (
        v_reservation.id,
        v_document_type,
        false,
        CASE 
          WHEN v_document_type = 'CMF' THEN 'Certificado CMF'
          WHEN v_document_type = 'LIQUIDACIONES' THEN 'Liquidaciones sueldo y/o Boletas de Honorario'
          WHEN v_document_type = 'AFP' THEN 'Certificado de AFP'
          WHEN v_document_type = 'ONU' THEN 'Certificado ONU'
          WHEN v_document_type = 'NO_DOCS' THEN 'Cliente no envía documentos'
          ELSE NULL
        END
      )
      ON CONFLICT (reservation_id, document_type) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;