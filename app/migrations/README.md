# Database Migrations

This directory contains SQL migration scripts for the application database.

## Migration Files

### `add_job_credits_limit.sql`
- **Purpose**: Adds `job_credits_limit` column to `organization_usage_limits` table
- **Date**: 2026-02-01
- **Description**: Enables organization-level job credit limit management for billing system

### `add_job_credit_events_billing_columns.sql`
- **Purpose**: Adds billing/period columns to existing `job_credit_events` table for event-based usage
- **Date**: 2026-02-02
- **Description**: Adds `organization_id`, `billing_period_start`, `job_type`, `is_overage` and index for “used credits this period” queries. Run this before using the new event-based job credit flow.

### `create_billing_invoices.sql`
- **Purpose**: Creates `billing_invoices` and `billing_notifications` tables for Stripe invoice storage and in-app billing alerts
- **Date**: 2026-02-08
- **Description**: Use after enabling invoice webhooks (upcoming, finalized, paid, payment_failed). Run: `npx tsx run-migration.ts create_billing_invoices.sql`

## Running Migrations

### Method 1: Using TypeScript Runner (Recommended)
```bash
# Run migration
npx tsx run-migration.ts add_job_credits_limit.sql

# Run rollback
npx tsx rollback-migration.ts rollback_add_job_credits_limit.sql
```

### Method 2: Using psql (PostgreSQL)
```bash
psql -h localhost -U your_username -d your_database -f migrations/add_job_credits_limit.sql
```

### Method 3: Manual Execution
1. Connect to your PostgreSQL database
2. Copy and paste the SQL from the migration file
3. Execute the commands

## Environment Variables

The migration runners will automatically use your existing database configuration:

**Option 1: DATABASE_URL (Recommended)**
```bash
DATABASE_URL=postgresql://username:password@host:port/database
```

**Option 2: Individual Parameters**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
```

The runners will first try to use `DATABASE_URL` (which you already have in your `.env`), and fall back to individual parameters if needed.

## Verification

After running the migration, you can verify it worked correctly:

```sql
-- Check if the column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'organization_usage_limits' 
AND column_name = 'job_credits_limit';

-- Check existing data
SELECT organization_id, job_credits_limit 
FROM organization_usage_limits 
LIMIT 5;
```

## Rollback

If you need to rollback this migration:

```sql
-- Remove the index first
DROP INDEX IF EXISTS idx_organization_usage_limits_job_credits;

-- Remove the column
ALTER TABLE organization_usage_limits 
DROP COLUMN IF EXISTS job_credits_limit;
```
