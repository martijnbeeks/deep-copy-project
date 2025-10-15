-- Migration to add avatar-related fields to jobs table
-- Run this migration to support the new customer avatar system

-- Add new fields to jobs table
ALTER TABLE jobs 
ADD COLUMN target_approach VARCHAR(50),
ADD COLUMN customer_avatars JSONB;

-- Add comments for documentation
COMMENT ON COLUMN jobs.target_approach IS 'Either "explore" or "known" - determines how customer avatars are obtained';
COMMENT ON COLUMN jobs.customer_avatars IS 'JSON array of customer avatar objects with persona_name, description, age_range, gender, key_buying_motivation';

-- Create index for better performance on target_approach queries
CREATE INDEX idx_jobs_target_approach ON jobs(target_approach);

-- Create GIN index for JSONB customer_avatars for better query performance
CREATE INDEX idx_jobs_customer_avatars ON jobs USING GIN (customer_avatars);
