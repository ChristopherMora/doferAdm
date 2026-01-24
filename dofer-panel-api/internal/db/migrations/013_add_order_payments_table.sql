-- Migración: Agregar tabla de pagos para órdenes
-- Fecha: 2026-01-24

-- Tabla de pagos de órdenes (similar a quote_payments)
CREATE TABLE IF NOT EXISTS order_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX idx_order_payments_date ON order_payments(payment_date DESC);

-- Comentarios
COMMENT ON TABLE order_payments IS 'Registro de pagos realizados para cada orden';
COMMENT ON COLUMN order_payments.amount IS 'Monto del pago';
COMMENT ON COLUMN order_payments.payment_method IS 'Método de pago utilizado';
