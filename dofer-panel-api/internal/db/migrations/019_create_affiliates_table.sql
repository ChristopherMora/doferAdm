-- Tabla de afiliados: perfil de negocio (comisión, contacto, estado) ligado 1:1
-- a un usuario de login (users.role = 'affiliate').

BEGIN;

CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
    commission_value NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);

DROP TRIGGER IF EXISTS update_affiliates_updated_at ON affiliates;
CREATE TRIGGER update_affiliates_updated_at
    BEFORE UPDATE ON affiliates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE affiliates IS 'Perfil de negocio de cada afiliado: comisión a pagar y estado, ligado a su cuenta de login en users';
COMMENT ON COLUMN affiliates.commission_type IS 'percentage: % sobre el precio final del pedido; fixed: monto fijo por pedido aprobado';

COMMIT;
