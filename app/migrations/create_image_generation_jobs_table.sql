-- Migration: Create image_generation_jobs table
-- Description: Creates a separate table to track image generation jobs for background polling and recovery
-- Date: 2026-02-13
-- Purpose: Enable background processing of image generation jobs that survives browser closes

-- Create the image_generation_jobs table
CREATE TABLE image_generation_jobs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    external_job_id TEXT NOT NULL UNIQUE, -- Backend API job ID
    injected_template_id TEXT NOT NULL, -- Reference to injected_templates table (no FK to avoid constraints)
    user_id TEXT NOT NULL, -- Reference to users table (no FK to avoid constraints)
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    prompts JSONB NOT NULL, -- Store the original prompts for reference
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    result_images JSONB, -- Store generated images when completed
    error_message TEXT -- Store error message if failed
);

-- Add comments for documentation
COMMENT ON TABLE image_generation_jobs IS 'Tracks image generation jobs for background polling and recovery';
COMMENT ON COLUMN image_generation_jobs.id IS 'Primary key - local database ID';
COMMENT ON COLUMN image_generation_jobs.external_job_id IS 'Backend API job ID from prelander-images service';
COMMENT ON COLUMN image_generation_jobs.injected_template_id IS 'Template ID that images are being generated for';
COMMENT ON COLUMN image_generation_jobs.user_id IS 'User who initiated the image generation';
COMMENT ON COLUMN image_generation_jobs.status IS 'Current status of the job';
COMMENT ON COLUMN image_generation_jobs.prompts IS 'Original prompts used for image generation';
COMMENT ON COLUMN image_generation_jobs.result_images IS 'Generated image URLs when job completes';
COMMENT ON COLUMN image_generation_jobs.error_message IS 'Error details if job fails';

-- Create indexes for performance
CREATE INDEX idx_image_generation_jobs_status ON image_generation_jobs(status);
CREATE INDEX idx_image_generation_jobs_user_id ON image_generation_jobs(user_id);
CREATE INDEX idx_image_generation_jobs_external_job_id ON image_generation_jobs(external_job_id);
CREATE INDEX idx_image_generation_jobs_created_at ON image_generation_jobs(created_at);
CREATE INDEX idx_image_generation_jobs_updated_at ON image_generation_jobs(updated_at);

-- Create index for finding jobs that need polling (pending/processing and recently updated)
CREATE INDEX idx_image_generation_jobs_polling ON image_generation_jobs(status, updated_at) 
WHERE status IN ('pending', 'processing');

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_image_generation_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_image_generation_jobs_updated_at
    BEFORE UPDATE ON image_generation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_image_generation_jobs_updated_at();

-- Verify the migration
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'image_generation_jobs'
ORDER BY ordinal_position;

-- Show table statistics
SELECT 
    COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_name = 'image_generation_jobs';

-- Show indexes created
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'image_generation_jobs'
ORDER BY indexname;
