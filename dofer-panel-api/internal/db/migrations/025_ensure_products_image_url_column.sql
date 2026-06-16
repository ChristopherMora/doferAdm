-- Asegura compatibilidad con bases creadas antes de que products.image_url
-- quedara en el esquema consolidado. El API de productos ya lee/escribe esta
-- columna, por eso debe existir también en instalaciones incrementales.

BEGIN;

ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN products.image_url IS 'URL opcional de imagen del producto para catalogo y vistas administrativas';

COMMIT;
