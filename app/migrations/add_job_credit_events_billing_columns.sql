-- Migration: Add billing/period columns to job_credit_events for event-based usage
-- Enables "used credits this period" = SUM(credits) WHERE organization_id AND billing_period_start
-- Date: 2026-02-02

-- Add columns (nullable to allow existing rows; new inserts should set them)
ALTER TABLE job_credit_events
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS job_type VARCHAR(50) CHECK (job_type IN ('deep_research', 'pre_lander', 'static_ads')),
  ADD COLUMN IF NOT EXISTS is_overage BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN job_credit_events.organization_id IS 'Org that consumed the credit; used for SUM(credits) per period.';
COMMENT ON COLUMN job_credit_events.billing_period_start IS 'Start of billing period this event belongs to (month for free, subscription period for paid).';
COMMENT ON COLUMN job_credit_events.job_type IS 'deep_research | pre_lander | static_ads for analytics.';
COMMENT ON COLUMN job_credit_events.is_overage IS 'True if event was over plan limit (Stripe overage).';

CREATE INDEX IF NOT EXISTS idx_job_credit_events_org_period
  ON job_credit_events(organization_id, billing_period_start)
  WHERE organization_id IS NOT NULL AND billing_period_start IS NOT NULL;
