-- Fecha de la venta separada de la fecha de registro.
-- Permite capturar ventas de días anteriores sin perder la huella de cuándo
-- se capturaron: created_at sigue siendo el momento en que entró al sistema.

ALTER TABLE bazar_sales ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

UPDATE bazar_sales SET sold_at = created_at WHERE sold_at IS NULL;

ALTER TABLE bazar_sales ALTER COLUMN sold_at SET DEFAULT NOW();
ALTER TABLE bazar_sales ALTER COLUMN sold_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bazar_sales_sold_at
    ON bazar_sales (organization_id, sold_at DESC);

CREATE INDEX IF NOT EXISTS idx_bazar_sales_bazar_sold_at
    ON bazar_sales (organization_id, bazar_id, sold_at DESC);
