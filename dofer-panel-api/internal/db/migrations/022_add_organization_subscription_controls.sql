-- Subscription and access controls per organization.
-- These fields let admins pause app usage when a workspace is unpaid or expired.

BEGIN;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS access_suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS billing_notes TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS max_members INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_orders_per_month INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'organizations_subscription_plan_check'
    ) THEN
        ALTER TABLE organizations
        ADD CONSTRAINT organizations_subscription_plan_check
        CHECK (subscription_plan IN ('trial', 'starter', 'professional', 'enterprise', 'custom', 'internal'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'organizations_subscription_status_check'
    ) THEN
        ALTER TABLE organizations
        ADD CONSTRAINT organizations_subscription_status_check
        CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'suspended', 'cancelled'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'organizations_max_members_nonnegative_check'
    ) THEN
        ALTER TABLE organizations
        ADD CONSTRAINT organizations_max_members_nonnegative_check
        CHECK (max_members >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'organizations_max_orders_per_month_nonnegative_check'
    ) THEN
        ALTER TABLE organizations
        ADD CONSTRAINT organizations_max_orders_per_month_nonnegative_check
        CHECK (max_orders_per_month >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status
ON organizations(subscription_status);

CREATE INDEX IF NOT EXISTS idx_organizations_subscription_ends_at
ON organizations(subscription_ends_at);

COMMIT;
