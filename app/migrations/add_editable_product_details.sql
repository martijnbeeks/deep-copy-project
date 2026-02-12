-- Add editable_product_details JSONB column to jobs table
ALTER TABLE jobs ADD COLUMN editable_product_details JSONB DEFAULT '{}';

-- Add GIN index for better JSONB query performance
CREATE INDEX IF NOT EXISTS idx_jobs_editable_product_details ON jobs USING GIN(editable_product_details);

-- Add comment to document the column
COMMENT ON COLUMN jobs.editable_product_details IS 'Stores user-editable product details that override the original AI-generated product information';
