-- Finance expense tracking and non-destructive finance cleanup.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS finance_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    reset_at TIMESTAMPTZ,
    reset_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reset_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'operacion',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    expense_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vendor TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_org_date
ON finance_expenses(organization_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_org_category
ON finance_expenses(organization_id, category);

DROP TRIGGER IF EXISTS update_finance_settings_updated_at ON finance_settings;
CREATE TRIGGER update_finance_settings_updated_at
    BEFORE UPDATE ON finance_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_finance_expenses_updated_at ON finance_expenses;
CREATE TRIGGER update_finance_expenses_updated_at
    BEFORE UPDATE ON finance_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE finance_settings IS 'Configuracion financiera por organizacion; reset_at marca el corte visible de finanzas sin borrar datos fuente';
COMMENT ON TABLE finance_expenses IS 'Gastos administrativos/operativos usados para calcular utilidad financiera';

COMMIT;
