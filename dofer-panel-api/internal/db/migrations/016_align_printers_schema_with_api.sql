-- Align legacy printers schema with current API expectations

BEGIN;

ALTER TABLE printers
    ADD COLUMN IF NOT EXISTS model TEXT,
    ADD COLUMN IF NOT EXISTS material TEXT;

DO $do$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'printers'
          AND column_name = 'type'
    ) THEN
        EXECUTE $sql$
            UPDATE printers
            SET model = COALESCE(model, NULLIF(BTRIM(type), ''))
            WHERE model IS NULL OR BTRIM(model) = ''
        $sql$;
    END IF;
END $do$;

DO $do$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'printers'
          AND column_name = 'materials'
    ) THEN
        EXECUTE $sql$
            UPDATE printers
            SET material = COALESCE(
                material,
                NULLIF(
                    BTRIM(
                        CASE
                            WHEN jsonb_typeof(to_jsonb(materials)) = 'array' THEN (
                                SELECT string_agg(value, ',')
                                FROM jsonb_array_elements_text(to_jsonb(materials)) AS value
                            )
                            WHEN jsonb_typeof(to_jsonb(materials)) = 'string' THEN to_jsonb(materials) #>> '{}'
                            ELSE to_jsonb(materials)::text
                        END
                    ),
                    ''
                )
            )
            WHERE material IS NULL OR BTRIM(material) = ''
        $sql$;
    END IF;
END $do$;

UPDATE printers
SET model = name
WHERE model IS NULL OR BTRIM(model) = '';

COMMIT;
