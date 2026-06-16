-- Solicitudes de pedido registradas por afiliados, pendientes de aprobación
-- del dueño/operador antes de convertirse en una orden real (orders).
-- Análogo a "quotes" antes de su conversión a "orders".

BEGIN;

CREATE TABLE IF NOT EXISTS affiliate_order_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id),
    product_id UUID REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    suggested_price_snapshot NUMERIC(10,2),
    final_price NUMERIC(10,2) NOT NULL CHECK (final_price >= 0),
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    customer_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    order_id UUID REFERENCES orders(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_affiliate_id ON affiliate_order_requests(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_status ON affiliate_order_requests(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_created_at ON affiliate_order_requests(created_at DESC);

DROP TRIGGER IF EXISTS update_affiliate_order_requests_updated_at ON affiliate_order_requests;
CREATE TRIGGER update_affiliate_order_requests_updated_at
    BEFORE UPDATE ON affiliate_order_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE affiliate_order_requests IS 'Pedido de un cliente final registrado por un afiliado; queda pending hasta que admin/operator lo aprueba (genera una orders real) o lo rechaza';
COMMENT ON COLUMN affiliate_order_requests.suggested_price_snapshot IS 'Copia del products.suggested_price al momento de crear la solicitud, solo para referencia/auditoría';
COMMENT ON COLUMN affiliate_order_requests.final_price IS 'Precio que el afiliado define y cobrará a su cliente final';

COMMIT;
