-- Add templates_images to job_credit_events job_type CHECK constraint
-- This migration updates the job_type column to include templates_images

ALTER TABLE job_credit_events
  DROP CONSTRAINT IF EXISTS job_credit_events_job_type_check;

ALTER TABLE job_credit_events
  ADD CONSTRAINT job_credit_events_job_type_check 
  CHECK (job_type IN ('deep_research', 'pre_lander', 'static_ads', 'templates_images'));

COMMENT ON COLUMN job_credit_events.job_type IS 'Type of job that consumed credits: deep_research, pre_lander, static_ads, or templates_images';
