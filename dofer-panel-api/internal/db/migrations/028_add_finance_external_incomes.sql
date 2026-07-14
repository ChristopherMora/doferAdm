-- External income tracking for payments not tied to orders or quotes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS finance_external_incomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source TEXT NOT NULL DEFAULT 'otros',
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    income_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payer TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_external_incomes_org_date
ON finance_external_incomes(organization_id, income_date DESC);

CREATE INDEX IF NOT EXISTS idx_finance_external_incomes_org_source
ON finance_external_incomes(organization_id, source);

DROP TRIGGER IF EXISTS update_finance_external_incomes_updated_at ON finance_external_incomes;
CREATE TRIGGER update_finance_external_incomes_updated_at
    BEFORE UPDATE ON finance_external_incomes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE finance_external_incomes IS 'Ingresos externos no ligados a pedidos/cotizaciones, como TikTok Shop, ventas externas de afiliados o efectivo';

COMMIT;
