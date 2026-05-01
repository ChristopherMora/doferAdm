-- Ensure finance/admin screens have the columns used by the API.
-- Idempotent for production databases that were evolved manually.

BEGIN;

ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS quotes ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS quotes ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS quotes ADD COLUMN IF NOT EXISTS tax NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS quotes ADD COLUMN IF NOT EXISTS total NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS quotes ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS quotes ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS quotes ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 days');
ALTER TABLE IF EXISTS quotes ADD COLUMN IF NOT EXISTS converted_to_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF to_regclass('public.quotes') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'quotes'
             AND column_name = 'total_price'
       ) THEN
        UPDATE quotes
        SET total = COALESCE(NULLIF(total, 0), total_price, 0)
        WHERE total = 0 OR total IS NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.quotes') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'quotes'
             AND column_name = 'expires_at'
       ) THEN
        UPDATE quotes
        SET valid_until = COALESCE(expires_at, valid_until)
        WHERE valid_until IS NULL;
    END IF;
END $$;

UPDATE orders SET balance = GREATEST(amount - amount_paid, 0) WHERE balance = 0 AND amount > 0;
UPDATE quotes SET balance = GREATEST(total - amount_paid, 0) WHERE balance = 0 AND total > 0;

COMMIT;
