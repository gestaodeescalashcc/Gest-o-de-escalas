/*
  # Add is_online field to punch_records
  
  1. Changes
    - Add `is_online` column to punch_records table
    - Default to true (most punches are online via browser)
    
  2. Purpose
    - Required for AFD tipo 7 (campo 7) according to Portaria MTP 671/2021
    - 0 = online, 1 = offline
*/

ALTER TABLE punch_records 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT true;