BEGIN;

DO $$
DECLARE
    source_added BOOLEAN;
    policy_added BOOLEAN;
BEGIN
    SELECT NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'products'
          AND column_name = 'bazar_source'
    ) INTO source_added;
    SELECT NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'products'
          AND column_name = 'stock_sync_policy'
    ) INTO policy_added;

    ALTER TABLE products
        ADD COLUMN IF NOT EXISTS bazar_source TEXT NOT NULL DEFAULT 'catalog',
        ADD COLUMN IF NOT EXISTS stock_sync_policy TEXT NOT NULL DEFAULT 'manual';

    IF source_added THEN
        UPDATE products
        SET bazar_source = CASE
            WHEN sheet_row IS NOT NULL THEN 'sheets'
            WHEN bazar_enabled THEN 'manual'
            ELSE 'catalog'
        END;
    END IF;
    IF policy_added THEN
        UPDATE products
        SET stock_sync_policy = CASE
            WHEN sheet_row IS NOT NULL THEN 'sheets'
            ELSE 'manual'
        END;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_bazar_source_check'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_bazar_source_check
            CHECK (bazar_source IN ('manual', 'sheets', 'catalog'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_sync_policy_check'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_stock_sync_policy_check
            CHECK (stock_sync_policy IN ('manual', 'sheets'));
    END IF;
END $$;

ALTER TABLE bazaars
    ADD COLUMN IF NOT EXISTS opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS expected_cash NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS closing_cash NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS cash_difference NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS closing_notes TEXT,
    ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE bazar_inventory_movements
    ALTER COLUMN bazar_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS bazar_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    bazar_id UUID REFERENCES bazaars(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL DEFAULT 'Sistema',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bazar_audit_logs_org_created
    ON bazar_audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bazar_audit_logs_bazar_created
    ON bazar_audit_logs (bazar_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bazar_inventory_movements_bazar_created
    ON bazar_inventory_movements (bazar_id, created_at DESC);

COMMIT;
