BEGIN;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS variant_group_id UUID,
    ADD COLUMN IF NOT EXISTS variant_color TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'products_variant_color_check'
    ) THEN
        ALTER TABLE products
            ADD CONSTRAINT products_variant_color_check
            CHECK (
                variant_color IS NULL
                OR variant_color ~ '^#[0-9A-Fa-f]{6}$'
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_variant_group
    ON products (organization_id, variant_group_id)
    WHERE variant_group_id IS NOT NULL;

COMMIT;
