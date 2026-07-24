BEGIN;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sheet_row INTEGER,
    ADD COLUMN IF NOT EXISTS bazar_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sheet_synced_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_non_negative'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS bazaars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'archived')),
    default_payment_method TEXT NOT NULL DEFAULT 'cash'
        CHECK (default_payment_method IN ('cash', 'transfer', 'card', 'mercado_pago', 'other')),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bazar_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    external_id TEXT NOT NULL,
    client_request_id UUID NOT NULL,
    bazar_id UUID NOT NULL REFERENCES bazaars(id) ON DELETE RESTRICT,
    seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
    seller_name TEXT NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
    total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
    payment_method TEXT NOT NULL DEFAULT 'cash'
        CHECK (payment_method IN ('cash', 'transfer', 'card', 'mercado_pago', 'other')),
    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('completed', 'cancelled')),
    sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'error')),
    sync_attempts INTEGER NOT NULL DEFAULT 0 CHECK (sync_attempts >= 0),
    last_sync_at TIMESTAMPTZ,
    sync_error TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, external_id),
    UNIQUE (organization_id, client_request_id)
);

CREATE TABLE IF NOT EXISTS bazar_sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    sale_id UUID NOT NULL REFERENCES bazar_sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_external_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
    stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
    stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bazar_inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    sale_id UUID REFERENCES bazar_sales(id) ON DELETE SET NULL,
    bazar_id UUID NOT NULL REFERENCES bazaars(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL
        CHECK (movement_type IN (
            'sale', 'sale_cancelled', 'return', 'damaged', 'lost',
            'gift', 'sample', 'manual_adjustment', 'inventory_entry'
        )),
    quantity INTEGER NOT NULL,
    stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
    stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_bazar_catalog
    ON products (organization_id, bazar_enabled, is_active, category, name);
CREATE INDEX IF NOT EXISTS idx_bazaars_org_status
    ON bazaars (organization_id, status, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_bazar_sales_org_created
    ON bazar_sales (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bazar_sales_bazar_created
    ON bazar_sales (bazar_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bazar_sales_sync
    ON bazar_sales (organization_id, sync_status, created_at);
CREATE INDEX IF NOT EXISTS idx_bazar_sale_items_sale
    ON bazar_sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_bazar_inventory_movements_product
    ON bazar_inventory_movements (organization_id, product_id, created_at DESC);

DROP TRIGGER IF EXISTS update_bazaars_updated_at ON bazaars;
CREATE TRIGGER update_bazaars_updated_at
    BEFORE UPDATE ON bazaars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bazar_sales_updated_at ON bazar_sales;
CREATE TRIGGER update_bazar_sales_updated_at
    BEFORE UPDATE ON bazar_sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
