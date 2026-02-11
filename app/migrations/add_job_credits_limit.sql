-- Migration: Add job_credits_limit to organization_usage_limits
-- Description: Adds job credit limit column to support organization-level billing
-- Date: 2026-02-01

-- Add job_credits_limit column to organization_usage_limits table
ALTER TABLE organization_usage_limits 
ADD COLUMN job_credits_limit INTEGER DEFAULT 19;

-- Add comment to describe the column
COMMENT ON COLUMN organization_usage_limits.job_credits_limit IS 'Monthly job credit limit for free tier users in the organization (default: 19)';

-- Create index for better query performance
CREATE INDEX idx_organization_usage_limits_job_credits 
ON organization_usage_limits (organization_id) 
WHERE job_credits_limit IS NOT NULL;

-- Update existing records to ensure they have the default value
UPDATE organization_usage_limits 
SET job_credits_limit = 19 
WHERE job_credits_limit IS NULL;

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'organization_usage_limits' 
AND column_name = 'job_credits_limit';
