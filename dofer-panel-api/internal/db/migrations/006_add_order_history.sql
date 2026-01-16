-- Crear tabla order_history para historial detallado
-- Nota: Ya existe order_status_history, esta es para tracking más detallado

CREATE TABLE IF NOT EXISTS order_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    changed_by UUID REFERENCES users(id),
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at DESC);

COMMENT ON TABLE order_history IS 'Historial detallado de todas las acciones sobre órdenes';
