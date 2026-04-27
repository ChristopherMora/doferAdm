-- Multi-tenant foundation for beta workspaces.
-- Existing data is assigned to the initial DOFER organization.

BEGIN;

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
    '11111111-1111-1111-1111-111111111111'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, role)
SELECT
    '00000000-0000-0000-0000-000000000001',
    id,
    CASE WHEN role IN ('admin', 'operator', 'viewer') THEN role ELSE 'operator' END
FROM users
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

ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS quotes ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS customers ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS printers ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS cost_settings ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS order_payments ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS quote_payments ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS payments ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS quote_templates ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS printer_assignments ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS quote_items ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS order_status_history ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS order_timers ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS order_history ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE IF EXISTS order_time_entries ADD COLUMN IF NOT EXISTS organization_id UUID;

UPDATE orders SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE quotes SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE customers SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE products SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE printers SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE cost_settings SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE order_payments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE quote_payments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE payments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE quote_templates SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE printer_assignments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE order_items
SET organization_id = orders.organization_id
FROM orders
WHERE order_items.order_id = orders.id
  AND order_items.organization_id IS NULL;
UPDATE quote_items
SET organization_id = quotes.organization_id
FROM quotes
WHERE quote_items.quote_id = quotes.id
  AND quote_items.organization_id IS NULL;
UPDATE order_status_history
SET organization_id = orders.organization_id
FROM orders
WHERE order_status_history.order_id = orders.id
  AND order_status_history.organization_id IS NULL;
UPDATE order_timers
SET organization_id = orders.organization_id
FROM orders
WHERE order_timers.order_id = orders.id
  AND order_timers.organization_id IS NULL;
DO $$
BEGIN
    IF to_regclass('public.order_history') IS NOT NULL THEN
        UPDATE order_history
        SET organization_id = orders.organization_id
        FROM orders
        WHERE order_history.order_id = orders.id
          AND order_history.organization_id IS NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.order_time_entries') IS NOT NULL THEN
        UPDATE order_time_entries
        SET organization_id = orders.organization_id
        FROM orders
        WHERE order_time_entries.order_id = orders.id
          AND order_time_entries.organization_id IS NULL;
    END IF;
END $$;

ALTER TABLE IF EXISTS orders ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS quotes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS customers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS products ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS printers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS cost_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS order_payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS quote_payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS payments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS quote_templates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS printer_assignments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS order_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS quote_items ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS order_status_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS order_timers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS order_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS order_time_entries ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE IF EXISTS orders
    ADD CONSTRAINT orders_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE IF EXISTS quotes
    ADD CONSTRAINT quotes_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE IF EXISTS customers
    ADD CONSTRAINT customers_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE IF EXISTS products
    ADD CONSTRAINT products_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE IF EXISTS printers
    ADD CONSTRAINT printers_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE IF EXISTS cost_settings
    ADD CONSTRAINT cost_settings_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
ALTER TABLE IF EXISTS quotes DROP CONSTRAINT IF EXISTS quotes_quote_number_key;
ALTER TABLE IF EXISTS customers DROP CONSTRAINT IF EXISTS customers_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_org_sku_unique ON products(organization_id, sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_org_number_unique ON orders(organization_id, order_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_org_number_unique ON quotes(organization_id, quote_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_org_email_unique ON customers(organization_id, email);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotes_organization_id ON quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_organization_id ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_printers_organization_id ON printers(organization_id);
CREATE INDEX IF NOT EXISTS idx_cost_settings_organization_id ON cost_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_organization_id ON order_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_quote_payments_organization_id ON quote_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_quote_templates_organization_id ON quote_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_printer_assignments_organization_id ON printer_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_items_organization_id ON order_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_organization_id ON quote_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_organization_id ON order_status_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_timers_organization_id ON order_timers(organization_id);
DO $$
BEGIN
    IF to_regclass('public.order_history') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_order_history_organization_id ON order_history(organization_id);
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.order_time_entries') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_order_time_entries_organization_id ON order_time_entries(organization_id);
    END IF;
END $$;

COMMIT;
