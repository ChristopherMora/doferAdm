-- 003_add_order_timer.sql
-- Agregar campos para timer de órdenes

-- Habilitar extensión si no existe
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Agregar campos a la tabla orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS estimated_time_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_time_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS timer_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS timer_paused_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_timer_running BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS timer_total_paused_minutes INTEGER DEFAULT 0;

-- Crear tabla para historial de sesiones de tiempo
CREATE TABLE IF NOT EXISTS order_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    operator_id UUID REFERENCES users(id),
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    duration_minutes INTEGER,
    status VARCHAR(20) DEFAULT 'active', -- active, paused, completed
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_order_time_entries_order_id ON order_time_entries(order_id);
CREATE INDEX idx_order_time_entries_operator_id ON order_time_entries(operator_id);
CREATE INDEX idx_order_time_entries_started_at ON order_time_entries(started_at);

-- Comentarios
COMMENT ON COLUMN orders.estimated_time_minutes IS 'Tiempo estimado de producción en minutos';
COMMENT ON COLUMN orders.actual_time_minutes IS 'Tiempo real acumulado en minutos';
COMMENT ON COLUMN orders.timer_started_at IS 'Timestamp cuando se inició el timer actual';
COMMENT ON COLUMN orders.timer_paused_at IS 'Timestamp cuando se pausó el timer';
COMMENT ON COLUMN orders.is_timer_running IS 'Indica si el timer está corriendo actualmente';
COMMENT ON COLUMN orders.timer_total_paused_minutes IS 'Total de minutos que el timer ha estado en pausa';

COMMENT ON TABLE order_time_entries IS 'Historial de sesiones de trabajo en órdenes para tracking de tiempo';
