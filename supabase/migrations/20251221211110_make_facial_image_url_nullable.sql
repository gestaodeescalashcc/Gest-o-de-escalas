/*
  # Make facial_image_url nullable
  
  1. Changes
    - Alter `facial_image_url` column to allow NULL values
    - The facial descriptors are the essential data for recognition
    - The image URL is optional for display purposes only
*/

ALTER TABLE professional_facial_data 
ALTER COLUMN facial_image_url DROP NOT NULL;