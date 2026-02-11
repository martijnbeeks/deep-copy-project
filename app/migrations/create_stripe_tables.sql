-- Migration: Create Stripe-related tables
-- Creates customers, subscriptions, and stripe_webhook_logs tables
-- Date: 2026-02-04

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

-- Create indexes for customers
CREATE UNIQUE INDEX IF NOT EXISTS customers_pkey ON customers USING BTREE (id);
CREATE UNIQUE INDEX IF NOT EXISTS customers_stripe_customer_id_key ON customers USING BTREE (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_org_id ON customers USING BTREE (organization_id);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    last_event_created_at INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_pkey ON subscriptions USING BTREE (id);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key ON subscriptions USING BTREE (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions USING BTREE (organization_id);

-- Create stripe_webhook_logs table
CREATE TABLE IF NOT EXISTS stripe_webhook_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- Create indexes for stripe_webhook_logs
CREATE UNIQUE INDEX IF NOT EXISTS stripe_webhook_logs_pkey ON stripe_webhook_logs USING BTREE (id);
CREATE UNIQUE INDEX IF NOT EXISTS stripe_webhook_logs_stripe_event_id_key ON stripe_webhook_logs USING BTREE (stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_type ON stripe_webhook_logs USING BTREE (event_type);

-- Add comments for documentation
COMMENT ON TABLE customers IS 'Stripe customer information linked to organizations';
COMMENT ON TABLE subscriptions IS 'Stripe subscription information for organizations';
COMMENT ON TABLE stripe_webhook_logs IS 'Logs of incoming Stripe webhook events';

COMMENT ON COLUMN customers.stripe_customer_id IS 'Unique customer ID from Stripe';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Unique subscription ID from Stripe';
COMMENT ON COLUMN subscriptions.stripe_customer_id IS 'Stripe customer ID for this subscription';
COMMENT ON COLUMN subscriptions.last_event_created_at IS 'Timestamp of last webhook event processed';
COMMENT ON COLUMN stripe_webhook_logs.status IS 'Processing status: pending, processed, failed';
COMMENT ON COLUMN stripe_webhook_logs.error_message IS 'Error details if webhook processing failed';
