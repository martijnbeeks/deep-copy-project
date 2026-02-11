-- Migration: Create billing_invoices and billing_notifications tables
-- For storing Stripe invoice records and in-app billing notifications
-- Date: 2026-02-08

-- billing_invoices: one row per Stripe invoice (upcoming, paid, failed)
CREATE TABLE IF NOT EXISTS billing_invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT UNIQUE NOT NULL,
    amount_due INTEGER NOT NULL DEFAULT 0,
    amount_paid INTEGER,
    currency TEXT NOT NULL DEFAULT 'eur',
    status TEXT NOT NULL CHECK (status IN ('upcoming', 'open', 'paid', 'failed')),
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    billing_reason TEXT,
    hosted_invoice_url TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_stripe_invoice_id_key ON billing_invoices (stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_id ON billing_invoices (organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON billing_invoices (status);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_period ON billing_invoices (organization_id, period_end DESC);

COMMENT ON TABLE billing_invoices IS 'Stripe invoice records for display and notifications';
COMMENT ON COLUMN billing_invoices.amount_due IS 'Amount in cents';
COMMENT ON COLUMN billing_invoices.amount_paid IS 'Amount paid in cents (null for upcoming/failed)';
COMMENT ON COLUMN billing_invoices.billing_reason IS 'subscription_cycle, subscription_create, etc.';

-- billing_notifications: in-app notices for upcoming charge, payment success, payment failed
CREATE TABLE IF NOT EXISTS billing_notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('upcoming_invoice', 'payment_success', 'payment_failed')),
    title TEXT NOT NULL,
    message TEXT,
    payload JSONB,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_notifications_org_id ON billing_notifications (organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_notifications_read_at ON billing_notifications (read_at);
CREATE INDEX IF NOT EXISTS idx_billing_notifications_org_unread ON billing_notifications (organization_id) WHERE read_at IS NULL;

COMMENT ON TABLE billing_notifications IS 'In-app billing alerts (upcoming charge, paid, failed)';
