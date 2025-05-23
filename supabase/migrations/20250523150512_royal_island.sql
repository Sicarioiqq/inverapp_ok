/*
  # Increase precision of bono_pie_max_pct column

  1. Changes
    - Modify bono_pie_max_pct column to have precision 6 and scale 5
    - This allows storing percentage values up to 100% (1.00000) with 5 decimal places

  2. Reason
    - Previous precision (5,4) was insufficient for storing percentage values
    - New precision (6,5) allows storing values from 0.00000 to 9.99999
    - Since we store percentages as decimals (e.g. 0.15000 for 15%), this is sufficient
*/

ALTER TABLE project_commercial_policies 
ALTER COLUMN bono_pie_max_pct TYPE NUMERIC(6,5);