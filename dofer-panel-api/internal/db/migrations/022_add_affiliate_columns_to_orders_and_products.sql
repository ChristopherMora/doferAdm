-- Vincula orders con el afiliado que las originó (cuando aplica) y agrega
-- un precio de referencia por producto que los afiliados ven al armar
-- su solicitud de pedido.

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'affiliate_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN affiliate_id UUID REFERENCES affiliates(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_affiliate_id ON orders(affiliate_id) WHERE affiliate_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'suggested_price'
    ) THEN
        ALTER TABLE products ADD COLUMN suggested_price NUMERIC(10,2);
    END IF;
END $$;

COMMENT ON COLUMN orders.affiliate_id IS 'Afiliado que originó esta orden, si vino de una affiliate_order_requests aprobada';
COMMENT ON COLUMN products.suggested_price IS 'Precio de referencia configurado por el dueño; visible para afiliados al crear su solicitud de pedido';

COMMIT;
