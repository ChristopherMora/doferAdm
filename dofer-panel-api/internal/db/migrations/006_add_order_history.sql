-- Crear tabla order_history para historial detallado
-- Nota: Ya existe order_status_history, esta es para tracking más detallado

CREATE TABLE IF NOT EXISTS order_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id),
    change_type TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_history_order_id ON order_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_history_created_at ON order_history(created_at DESC);

COMMENT ON TABLE order_history IS 'Historial detallado de cambios en campos de órdenes';
COMMENT ON COLUMN order_history.change_type IS 'Tipo de cambio: status, assignment, field_update, etc';
COMMENT ON COLUMN order_history.field_name IS 'Nombre del campo que cambió';
COMMENT ON COLUMN order_history.old_value IS 'Valor anterior del campo';
COMMENT ON COLUMN order_history.new_value IS 'Valor nuevo del campo';
