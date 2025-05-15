/*
  # Add bank fields to reservations table

  1. Changes
    - Add bank fields for immediate delivery projects
    - Add columns for bank executive information
    
  2. Notes
    - All fields are nullable since they're only used for immediate delivery
*/

-- Add bank fields to reservations table
ALTER TABLE reservations
  ADD COLUMN bank_name text,
  ADD COLUMN bank_executive text,
  ADD COLUMN bank_executive_email text,
  ADD COLUMN bank_executive_phone text;