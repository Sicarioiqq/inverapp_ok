/*
  # Add finance contact phone field to brokers table

  1. Changes
    - Add `finance_contact_phone` column to brokers table
    
  2. Notes
    - Field is optional (nullable)
    - Matches structure of other contact phone fields
*/

ALTER TABLE brokers ADD COLUMN finance_contact_phone text;