-- Rollback Migration: Remove job_credits_limit from organization_usage_limits
-- Description: Removes job credit limit column and related indexes
-- Date: 2026-02-01

-- Remove the index first (if it exists)
DROP INDEX IF EXISTS idx_organization_usage_limits_job_credits;

-- Remove the column
ALTER TABLE organization_usage_limits 
DROP COLUMN IF EXISTS job_credits_limit;

-- Verify the rollback
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'organization_usage_limits' 
AND column_name = 'job_credits_limit';

-- Should return no rows if successful
