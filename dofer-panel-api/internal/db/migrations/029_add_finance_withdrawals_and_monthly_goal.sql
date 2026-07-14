-- Personal withdrawals and monthly goal for simple finance tracking.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE finance_settings
ADD COLUMN IF NOT EXISTS monthly_goal_amount NUMERIC(12, 2) NOT NULL DEFAULT 30000 CHECK (monthly_goal_amount >= 0);

CREATE TABLE IF NOT EXISTS finance_withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    withdrawal_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_withdrawals_org_date
ON finance_withdrawals(organization_id, withdrawal_date DESC);

DROP TRIGGER IF EXISTS update_finance_withdrawals_updated_at ON finance_withdrawals;
CREATE TRIGGER update_finance_withdrawals_updated_at
    BEFORE UPDATE ON finance_withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN finance_settings.monthly_goal_amount IS 'Meta mensual simple de ingresos para DOFER';
COMMENT ON TABLE finance_withdrawals IS 'Retiros personales del dueno; reducen dinero disponible pero no son gasto del negocio';

COMMIT;
