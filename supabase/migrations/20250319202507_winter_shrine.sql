/*
  # Fix cascade deletion for reservations

  1. Changes
    - Add ON DELETE CASCADE to foreign keys referencing reservations
    - This ensures all related records are automatically deleted

  2. Security
    - Maintain existing RLS policies
    - Ensure only admins can delete reservations
*/

-- Drop existing foreign keys
ALTER TABLE reservation_flows 
  DROP CONSTRAINT IF EXISTS reservation_flows_reservation_id_fkey;

ALTER TABLE broker_commissions 
  DROP CONSTRAINT IF EXISTS broker_commissions_reservation_id_fkey;

-- Recreate foreign keys with CASCADE
ALTER TABLE reservation_flows
  ADD CONSTRAINT reservation_flows_reservation_id_fkey
  FOREIGN KEY (reservation_id)
  REFERENCES reservations(id)
  ON DELETE CASCADE;

ALTER TABLE broker_commissions
  ADD CONSTRAINT broker_commissions_reservation_id_fkey
  FOREIGN KEY (reservation_id)
  REFERENCES reservations(id)
  ON DELETE CASCADE;