-- Controles operativos para solicitudes de afiliados: pagos del cliente,
-- entrega, fecha prometida, checklist interno y duplicado de solicitudes.

BEGIN;

ALTER TABLE IF EXISTS affiliate_order_requests
    ADD COLUMN IF NOT EXISTS customer_amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (customer_amount_paid >= 0),
    ADD COLUMN IF NOT EXISTS customer_payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (customer_payment_status IN ('unpaid', 'deposit', 'paid')),
    ADD COLUMN IF NOT EXISTS customer_payment_method TEXT,
    ADD COLUMN IF NOT EXISTS customer_payment_reference TEXT,
    ADD COLUMN IF NOT EXISTS customer_payment_notes TEXT,
    ADD COLUMN IF NOT EXISTS promised_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'pickup'
        CHECK (delivery_method IN ('pickup', 'local_delivery', 'shipping')),
    ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (delivery_status IN ('pending', 'ready', 'delivered', 'shipped', 'cancelled')),
    ADD COLUMN IF NOT EXISTS delivery_address TEXT,
    ADD COLUMN IF NOT EXISTS delivery_tracking_number TEXT,
    ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
    ADD COLUMN IF NOT EXISTS production_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS internal_owner_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS duplicated_from_request_id UUID REFERENCES affiliate_order_requests(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS affiliate_order_requests
    DROP CONSTRAINT IF EXISTS affiliate_order_requests_customer_amount_paid_lte_final_price;
ALTER TABLE IF EXISTS affiliate_order_requests
    ADD CONSTRAINT affiliate_order_requests_customer_amount_paid_lte_final_price
    CHECK (customer_amount_paid <= final_price);

ALTER TABLE IF EXISTS affiliate_order_requests
    DROP CONSTRAINT IF EXISTS affiliate_order_requests_production_checklist_object;
ALTER TABLE IF EXISTS affiliate_order_requests
    ADD CONSTRAINT affiliate_order_requests_production_checklist_object
    CHECK (jsonb_typeof(production_checklist) = 'object');

CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_promised_delivery_date
    ON affiliate_order_requests(promised_delivery_date);
CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_payment_status
    ON affiliate_order_requests(customer_payment_status);
CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_delivery_status
    ON affiliate_order_requests(delivery_status);
CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_internal_owner
    ON affiliate_order_requests(internal_owner_id);

COMMENT ON COLUMN affiliate_order_requests.customer_amount_paid IS 'Monto que el cliente final ya pagó al afiliado';
COMMENT ON COLUMN affiliate_order_requests.customer_payment_status IS 'Estado de pago del cliente final: unpaid, deposit, paid';
COMMENT ON COLUMN affiliate_order_requests.promised_delivery_date IS 'Fecha prometida al cliente final';
COMMENT ON COLUMN affiliate_order_requests.delivery_method IS 'Método de entrega: pickup, local_delivery o shipping';
COMMENT ON COLUMN affiliate_order_requests.delivery_status IS 'Estado de entrega visible para control operativo';
COMMENT ON COLUMN affiliate_order_requests.production_checklist IS 'Checklist interno de preparación/producción/empaque/entrega';
COMMENT ON COLUMN affiliate_order_requests.internal_owner_id IS 'Usuario interno responsable de dar seguimiento a la solicitud';
COMMENT ON COLUMN affiliate_order_requests.duplicated_from_request_id IS 'Solicitud origen cuando el afiliado duplica un pedido previo';

COMMIT;
