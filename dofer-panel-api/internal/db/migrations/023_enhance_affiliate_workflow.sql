-- Mejora el flujo de afiliados para multi-organizacion, evidencias visuales,
-- prioridad, reglas de catalogo y pagos por lote.

BEGIN;

ALTER TABLE IF EXISTS affiliates ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE affiliates
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;
ALTER TABLE IF EXISTS affiliates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS affiliates
    DROP CONSTRAINT IF EXISTS affiliates_organization_id_fkey;
ALTER TABLE IF EXISTS affiliates
    ADD CONSTRAINT affiliates_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS affiliates ADD COLUMN IF NOT EXISTS referral_code TEXT;
UPDATE affiliates
SET referral_code = lower(
    regexp_replace(
        trim(both '-' from regexp_replace(display_name, '[^a-zA-Z0-9]+', '-', 'g')),
        '-+',
        '-',
        'g'
    )
) || '-' || left(replace(id::text, '-', ''), 6)
WHERE referral_code IS NULL OR trim(referral_code) = '';
ALTER TABLE IF EXISTS affiliates ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliates_org_referral_code
    ON affiliates(organization_id, referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_organization_id
    ON affiliates(organization_id);

ALTER TABLE IF EXISTS affiliate_order_requests ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE affiliate_order_requests req
SET organization_id = a.organization_id
FROM affiliates a
WHERE req.affiliate_id = a.id
  AND req.organization_id IS NULL;
UPDATE affiliate_order_requests
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;
ALTER TABLE IF EXISTS affiliate_order_requests ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS affiliate_order_requests
    DROP CONSTRAINT IF EXISTS affiliate_order_requests_organization_id_fkey;
ALTER TABLE IF EXISTS affiliate_order_requests
    ADD CONSTRAINT affiliate_order_requests_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS affiliate_order_requests
    ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE IF EXISTS affiliate_order_requests
    DROP CONSTRAINT IF EXISTS affiliate_order_requests_priority_check;
ALTER TABLE IF EXISTS affiliate_order_requests
    ADD CONSTRAINT affiliate_order_requests_priority_check
    CHECK (priority IN ('urgent', 'normal', 'low'));

ALTER TABLE IF EXISTS affiliate_order_requests
    ADD COLUMN IF NOT EXISTS reference_images JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS affiliate_order_requests
    DROP CONSTRAINT IF EXISTS affiliate_order_requests_reference_images_check;
ALTER TABLE IF EXISTS affiliate_order_requests
    ADD CONSTRAINT affiliate_order_requests_reference_images_check
    CHECK (jsonb_typeof(reference_images) = 'array');

ALTER TABLE IF EXISTS affiliate_order_requests
    ADD COLUMN IF NOT EXISTS min_price_snapshot NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_organization_id
    ON affiliate_order_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_org_status
    ON affiliate_order_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_order_requests_priority
    ON affiliate_order_requests(priority);

ALTER TABLE IF EXISTS affiliate_commissions ADD COLUMN IF NOT EXISTS organization_id UUID;
UPDATE affiliate_commissions c
SET organization_id = a.organization_id
FROM affiliates a
WHERE c.affiliate_id = a.id
  AND c.organization_id IS NULL;
UPDATE affiliate_commissions
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;
ALTER TABLE IF EXISTS affiliate_commissions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE IF EXISTS affiliate_commissions
    DROP CONSTRAINT IF EXISTS affiliate_commissions_organization_id_fkey;
ALTER TABLE IF EXISTS affiliate_commissions
    ADD CONSTRAINT affiliate_commissions_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

ALTER TABLE IF EXISTS affiliate_commissions ADD COLUMN IF NOT EXISTS paid_batch_id UUID;
ALTER TABLE IF EXISTS affiliate_commissions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE IF EXISTS affiliate_commissions ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_organization_id
    ON affiliate_commissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_org_status
    ON affiliate_commissions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_paid_batch_id
    ON affiliate_commissions(paid_batch_id) WHERE paid_batch_id IS NOT NULL;

ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS affiliate_visible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS affiliate_min_price NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_products_affiliate_catalog
    ON products(organization_id, is_active, affiliate_visible);

INSERT INTO organization_members (organization_id, user_id, role)
SELECT organization_id, user_id, 'viewer'
FROM affiliates
ON CONFLICT (organization_id, user_id) DO NOTHING;

COMMENT ON COLUMN affiliate_order_requests.reference_images IS 'Imagenes de referencia cargadas por el afiliado para mostrar lo que el cliente quiere';
COMMENT ON COLUMN affiliate_order_requests.priority IS 'Prioridad solicitada por el afiliado; se copia a la orden cuando se aprueba';
COMMENT ON COLUMN affiliate_order_requests.min_price_snapshot IS 'Precio minimo de afiliado congelado al crear la solicitud, si el producto lo tenia configurado';
COMMENT ON COLUMN products.affiliate_visible IS 'Controla si el producto aparece en el catalogo del portal de afiliados';
COMMENT ON COLUMN products.affiliate_min_price IS 'Precio minimo permitido para solicitudes de afiliado sobre este producto';
COMMENT ON COLUMN affiliates.referral_code IS 'Codigo/link humano para identificar al afiliado';

COMMIT;
