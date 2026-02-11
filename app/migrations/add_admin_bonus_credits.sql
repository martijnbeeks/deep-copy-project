-- Migration: Add admin_bonus_credits to organizations table
-- Description: Adds admin_bonus_credits column for admin-controlled credit bonuses
-- Date: 2026-02-03

-- Add admin_bonus_credits column to organizations table
ALTER TABLE organizations 
ADD COLUMN admin_bonus_credits INTEGER DEFAULT 0;

-- Add comment to describe the column
COMMENT ON COLUMN organizations.admin_bonus_credits IS 'Admin-controlled bonus credits added to organization (default: 0)';

-- Create index for better query performance
CREATE INDEX idx_organizations_admin_bonus_credits 
ON organizations (id) 
WHERE admin_bonus_credits IS NOT NULL;

-- Update existing records to ensure they have the default value
UPDATE organizations 
SET admin_bonus_credits = 0 
WHERE admin_bonus_credits IS NULL;

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name = 'admin_bonus_credits';
