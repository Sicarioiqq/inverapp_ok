/*
  # Reset operations status

  1. Changes
    - Reset all operations to initial state
    - Clear status, approval amounts and credit amounts
    - Maintain bank and executive information
    
  2. Notes
    - Preserves existing relationships
    - Maintains data integrity
*/

-- Reset all operations to initial state
UPDATE operations
SET 
  status = NULL,
  approval_amount = 0,
  credit_amount = 0,
  updated_at = now();

-- Delete all operation comments
DELETE FROM operation_comments;