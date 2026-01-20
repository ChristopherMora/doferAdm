-- Migración: Agregar tabla de items de pedidos
-- Fecha: 2026-01-19

-- Tabla de items de pedidos
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_completed ON order_items(is_completed);

-- Comentarios
COMMENT ON TABLE order_items IS 'Items individuales de cada pedido para tracking detallado';
COMMENT ON COLUMN order_items.is_completed IS 'Si el item está completado/producido';
