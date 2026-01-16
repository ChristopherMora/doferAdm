-- Agregar campo para imagen de producto
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_image TEXT;
