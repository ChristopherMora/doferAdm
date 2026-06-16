-- Agrega el rol 'affiliate' a users.role y la plataforma 'affiliate' a orders.platform
-- Sigue el patrón condicional (DROP/ADD constraint vía pg_constraint) usado en
-- 015_add_quote_templates_and_extend_printers_status.sql

BEGIN;

-- users.role: admin, operator, viewer -> + affiliate
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'users'
          AND c.conname = 'users_role_check'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'users'
          AND c.conname = 'users_role_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_role_check
            CHECK (role IN ('admin', 'operator', 'viewer', 'affiliate'));
    END IF;
END $$;

-- orders.platform: tiktok, shopify, local, other -> + affiliate
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'orders'
          AND c.conname = 'orders_platform_check'
    ) THEN
        ALTER TABLE orders DROP CONSTRAINT orders_platform_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'orders'
          AND c.conname = 'orders_platform_check'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT orders_platform_check
            CHECK (platform IN ('tiktok', 'shopify', 'local', 'other', 'affiliate'));
    END IF;
END $$;

COMMIT;
