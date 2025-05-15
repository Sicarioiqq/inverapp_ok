/*
  # Add payment tracking fields to broker_commissions

  1. New Fields
    - `purchase_order` (text) - N° OC
    - `invoice_1` (text) - N° Factura (primer pago)
    - `invoice_1_date` (date) - Fecha de Emisión (primer pago)
    - `payment_1_date` (date) - Fecha de Pago (primer pago)
    - `invoice_2` (text) - N° Factura (segundo pago)
    - `invoice_2_date` (date) - Fecha de Emisión (segundo pago)
    - `payment_2_date` (date) - Fecha de Pago (segundo pago)

  2. Notes
    - All fields are nullable since they'll be filled during the payment process
*/

ALTER TABLE broker_commissions
  ADD COLUMN purchase_order text,
  ADD COLUMN invoice_1 text,
  ADD COLUMN invoice_1_date date,
  ADD COLUMN payment_1_date date,
  ADD COLUMN invoice_2 text,
  ADD COLUMN invoice_2_date date,
  ADD COLUMN payment_2_date date;