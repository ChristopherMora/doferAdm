-- Ledger de comisiones que el negocio debe pagar a cada afiliado por sus
-- pedidos aprobados. El monto se congela como snapshot al aprobar la
-- solicitud (no se recalcula si la comisión del afiliado cambia después).

BEGIN;

CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id),
    affiliate_order_request_id UUID NOT NULL UNIQUE REFERENCES affiliate_order_requests(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    commission_amount NUMERIC(10,2) NOT NULL CHECK (commission_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_at TIMESTAMPTZ,
    paid_by UUID REFERENCES users(id),
    payment_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON affiliate_commissions(status);

DROP TRIGGER IF EXISTS update_affiliate_commissions_updated_at ON affiliate_commissions;
CREATE TRIGGER update_affiliate_commissions_updated_at
    BEFORE UPDATE ON affiliate_commissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE affiliate_commissions IS 'Comisión generada por cada solicitud de afiliado aprobada; pending hasta que el dueño la marca como paid';
COMMENT ON COLUMN affiliate_commissions.commission_amount IS 'Monto calculado y congelado al momento de aprobar la solicitud (snapshot, no se recalcula retroactivamente)';

COMMIT;
