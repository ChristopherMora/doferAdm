-- Migración: Agregar campos de pago a cotizaciones y órdenes
-- Fecha: 2026-01-19

-- Agregar campos de pago a quotes
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Agregar campos de pago a orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Actualizar balance existente en quotes para que sea igual al total
UPDATE quotes SET balance = total WHERE balance = 0 AND total > 0;

-- Comentarios
COMMENT ON COLUMN quotes.amount_paid IS 'Monto pagado por el cliente';
COMMENT ON COLUMN quotes.balance IS 'Saldo pendiente por pagar';
COMMENT ON COLUMN orders.amount IS 'Monto total de la orden';
COMMENT ON COLUMN orders.amount_paid IS 'Monto pagado por el cliente';
COMMENT ON COLUMN orders.balance IS 'Saldo pendiente por pagar';
