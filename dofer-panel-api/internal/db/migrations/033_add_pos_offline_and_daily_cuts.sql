BEGIN;

ALTER TABLE bazar_sales
    ADD COLUMN IF NOT EXISTS cash_received NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS change_due NUMERIC(12,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bazar_sales_cash_received_non_negative'
    ) THEN
        ALTER TABLE bazar_sales
            ADD CONSTRAINT bazar_sales_cash_received_non_negative
            CHECK (cash_received IS NULL OR cash_received >= 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bazar_sales_change_due_non_negative'
    ) THEN
        ALTER TABLE bazar_sales
            ADD CONSTRAINT bazar_sales_change_due_non_negative
            CHECK (change_due IS NULL OR change_due >= 0);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS bazar_daily_cuts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    bazar_id UUID NOT NULL REFERENCES bazaars(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    opening_cash NUMERIC(12,2) NOT NULL CHECK (opening_cash >= 0),
    cash_sales NUMERIC(12,2) NOT NULL CHECK (cash_sales >= 0),
    expected_cash NUMERIC(12,2) NOT NULL CHECK (expected_cash >= 0),
    closing_cash NUMERIC(12,2) NOT NULL CHECK (closing_cash >= 0),
    cash_difference NUMERIC(12,2) NOT NULL,
    notes TEXT,
    closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    closed_by_name TEXT NOT NULL DEFAULT 'Sistema',
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, bazar_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_bazar_daily_cuts_bazar_date
    ON bazar_daily_cuts (bazar_id, business_date DESC);

COMMIT;
