-- Migración: Agregar tabla de pagos para cotizaciones
-- Fecha: 2026-01-24

-- Tabla de pagos de cotizaciones
CREATE TABLE IF NOT EXISTS quote_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_quote_payments_quote_id ON quote_payments(quote_id);
CREATE INDEX idx_quote_payments_date ON quote_payments(payment_date DESC);

-- Comentarios
COMMENT ON TABLE quote_payments IS 'Registro de pagos realizados para cada cotización';
COMMENT ON COLUMN quote_payments.amount IS 'Monto del pago';
COMMENT ON COLUMN quote_payments.payment_method IS 'Método de pago utilizado';
