-- Add V2 API support to jobs table
-- This migration adds tracking for V2 vs V1 jobs

-- Add API version tracking
ALTER TABLE jobs 
ADD COLUMN api_version VARCHAR(10) DEFAULT 'v1' NOT NULL;

-- Add research type tracking  
ALTER TABLE jobs
ADD COLUMN research_type VARCHAR(20) DEFAULT 'legacy' NOT NULL;

-- Add index for performance
CREATE INDEX idx_jobs_api_version ON jobs(api_version);
CREATE INDEX idx_jobs_research_type ON jobs(research_type);

-- Update existing jobs to be marked as V1 legacy
UPDATE jobs 
SET api_version = 'v1', research_type = 'legacy' 
WHERE api_version = 'v1' OR api_version IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN jobs.api_version IS 'API version used: v1 (legacy) or v2 (unified)';
COMMENT ON COLUMN jobs.research_type IS 'Research type: legacy (V1) or unified (V2)';
