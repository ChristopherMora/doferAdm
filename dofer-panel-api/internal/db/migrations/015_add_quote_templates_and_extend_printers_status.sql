-- Add quote templates and extend printer status options

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'printers'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'printers'
              AND c.conname = 'printers_status_check'
        ) THEN
            ALTER TABLE printers DROP CONSTRAINT printers_status_check;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public'
              AND t.relname = 'printers'
              AND c.conname = 'printers_status_check'
        ) THEN
            ALTER TABLE printers
                ADD CONSTRAINT printers_status_check
                CHECK (status IN ('available', 'busy', 'maintenance', 'offline'));
        END IF;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS quote_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    material TEXT NOT NULL DEFAULT 'PLA',
    infill_percentage DECIMAL(5,2) NOT NULL DEFAULT 20 CHECK (infill_percentage >= 0 AND infill_percentage <= 100),
    layer_height DECIMAL(6,3) NOT NULL DEFAULT 0.2 CHECK (layer_height > 0),
    print_speed DECIMAL(8,2) NOT NULL DEFAULT 50 CHECK (print_speed > 0),
    base_cost DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (base_cost >= 0),
    markup_percentage DECIMAL(6,2) NOT NULL DEFAULT 30 CHECK (markup_percentage >= 0),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_templates_material ON quote_templates(material);
CREATE INDEX IF NOT EXISTS idx_quote_templates_created_at ON quote_templates(created_at DESC);

DROP TRIGGER IF EXISTS update_quote_templates_updated_at ON quote_templates;
CREATE TRIGGER update_quote_templates_updated_at
    BEFORE UPDATE ON quote_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
