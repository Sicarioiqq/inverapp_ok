-- Add days_to_complete if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payment_flow_tasks' 
    AND column_name = 'days_to_complete'
  ) THEN
    ALTER TABLE payment_flow_tasks 
    ADD COLUMN days_to_complete integer;
  END IF;
END $$;

-- Add expected completion dates for existing tasks
UPDATE payment_flow_tasks
SET days_to_complete = CASE
  WHEN name LIKE '%Solicitud%' THEN 1
  WHEN name LIKE '%VB%' THEN 2
  WHEN name LIKE '%Generación%' THEN 2
  WHEN name LIKE '%Aprobación%' THEN 2
  WHEN name LIKE '%Envío%' THEN 1
  WHEN name LIKE '%Recepción%' THEN 3
  ELSE 2
END
WHERE days_to_complete IS NULL;

-- Create function to calculate days elapsed
CREATE OR REPLACE FUNCTION calculate_days_elapsed(
  p_start_date timestamptz,
  p_end_date timestamptz
) RETURNS integer AS $$
BEGIN
  IF p_start_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN EXTRACT(DAY FROM COALESCE(p_end_date, now()) - p_start_date)::integer;
END;
$$ LANGUAGE plpgsql;