-- Repair multiuser beta rollout.
-- This migration is intentionally idempotent because the previous entrypoint
-- could mark 018 as applied even when psql failed later in the file.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;

UPDATE users
SET auth_user_id = id
WHERE auth_user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id
ON users(auth_user_id)
WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_members (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'operator', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_members_updated_at ON organization_members;
CREATE TRIGGER update_organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO organizations (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'DOFER',
    'dofer',
    NULL
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    updated_at = NOW();

INSERT INTO organization_members (organization_id, user_id, role)
SELECT
    '00000000-0000-0000-0000-000000000001',
    u.id,
    CASE WHEN u.role IN ('admin', 'operator', 'viewer') THEN u.role ELSE 'operator' END
FROM users u
WHERE NOT EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = u.id
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS order_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    changed_by TEXT,
    change_type TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
    tenant_table TEXT;
    default_org UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    FOREACH tenant_table IN ARRAY ARRAY[
        'orders',
        'quotes',
        'customers',
        'products',
        'printers',
        'cost_settings',
        'order_payments',
        'quote_payments',
        'payments',
        'quote_templates',
        'printer_assignments',
        'order_items',
        'quote_items',
        'order_status_history',
        'order_timers',
        'order_history',
        'order_time_entries'
    ]
    LOOP
        IF to_regclass(format('public.%I', tenant_table)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id UUID', tenant_table);
            EXECUTE format('UPDATE %I SET organization_id = $1 WHERE organization_id IS NULL', tenant_table) USING default_org;
            EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', tenant_table);
        END IF;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_organization_id ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_printers_organization_id ON printers(organization_id);
CREATE INDEX IF NOT EXISTS idx_cost_settings_organization_id ON cost_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_organization_id ON order_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_quote_payments_organization_id ON quote_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_quote_templates_organization_id ON quote_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_items_organization_id ON order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_organization_id ON quote_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_history_organization_id ON order_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_time_entries_organization_id ON order_time_entries(organization_id);

COMMIT;
