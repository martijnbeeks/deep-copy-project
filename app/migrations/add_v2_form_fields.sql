-- Add V2 form fields to jobs table
-- Migration: Store V2 form input fields directly in jobs table

ALTER TABLE jobs 
ADD COLUMN research_requirements TEXT,
ADD COLUMN target_gender VARCHAR(50),
ADD COLUMN target_location VARCHAR(100),
ADD COLUMN form_advertorial_type VARCHAR(50) DEFAULT 'Listicle';

-- Add indexes for performance if these fields will be queried
CREATE INDEX idx_jobs_target_gender ON jobs(target_gender) WHERE target_gender IS NOT NULL;
CREATE INDEX idx_jobs_target_location ON jobs(target_location) WHERE target_location IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN jobs.research_requirements IS 'V2 form: Research requirements and specifications';
COMMENT ON COLUMN jobs.target_gender IS 'V2 form: Target gender for marketing research';
COMMENT ON COLUMN jobs.target_location IS 'V2 form: Target location for marketing research';
COMMENT ON COLUMN jobs.form_advertorial_type IS 'V2 form: Advertorial type selected in form (Listicle, etc.)';
