-- Migration to add new fields to jobs table
-- Run this to update existing database schema

-- Add new columns to jobs table
ALTER TABLE jobs 
ADD COLUMN advertorial_type VARCHAR(50) NOT NULL DEFAULT 'Listicle',
ADD COLUMN persona TEXT,
ADD COLUMN age_range VARCHAR(50),
ADD COLUMN gender VARCHAR(20);

-- Update existing records to have a default advertorial_type
UPDATE jobs SET advertorial_type = 'Listicle' WHERE advertorial_type IS NULL;

-- Make advertorial_type NOT NULL after setting defaults
ALTER TABLE jobs ALTER COLUMN advertorial_type SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN advertorial_type DROP DEFAULT;
