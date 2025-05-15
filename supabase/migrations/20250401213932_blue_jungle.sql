/*
  # Add date fields to reservations table

  1. New Fields
    - `promise_date` (date) - Fecha de promesa
    - `deed_date` (date) - Fecha de escritura
    - `commission_payment_month` (text) - Mes de pago de comisión (formato YYYY-MM)

  2. Notes
    - All fields are nullable
    - commission_payment_month uses YYYY-MM format for month selection inputs
*/

-- Add date fields to reservations table
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS promise_date date,
  ADD COLUMN IF NOT EXISTS deed_date date,
  ADD COLUMN IF NOT EXISTS commission_payment_month text;