-- 004_add_delivery_deadline.sql
-- Agregar campo de fecha de entrega máxima a órdenes

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_deadline TIMESTAMP;

-- Índice para búsquedas y ordenamientos por fecha de entrega
CREATE INDEX IF NOT EXISTS idx_orders_delivery_deadline ON orders(delivery_deadline);

-- Comentario
COMMENT ON COLUMN orders.delivery_deadline IS 'Fecha y hora máxima de entrega prometida al cliente';
