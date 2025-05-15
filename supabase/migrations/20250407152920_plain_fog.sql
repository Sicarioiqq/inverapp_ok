/*
  # Add at_risk fields to broker_commissions table

  1. Changes
    - Add at_risk column to broker_commissions table
    - Add at_risk_reason column to broker_commissions table
    - These fields track if a commission is at risk of being rescinded
    
  2. Notes
    - at_risk is a boolean field, default false
    - at_risk_reason is a text field to store the reason
*/

-- Add at_risk fields to broker_commissions table
ALTER TABLE broker_commissions
  ADD COLUMN IF NOT EXISTS at_risk boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS at_risk_reason text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_broker_commissions_at_risk 
ON broker_commissions(at_risk);