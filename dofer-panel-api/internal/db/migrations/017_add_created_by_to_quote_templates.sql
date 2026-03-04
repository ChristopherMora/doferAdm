-- Agrega la columna created_by a quote_templates si no existe.
-- La tabla pudo haber sido creada antes de que la migración 015
-- incluyera esa columna (CREATE TABLE IF NOT EXISTS no modifica tablas existentes).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quote_templates' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE quote_templates ADD COLUMN created_by TEXT;
    END IF;
END $$;
