-- Control operativo avanzado para afiliados: estados de correccion/cancelacion,
-- bitacora, comentarios, reglas por afiliado y comisiones especiales por producto.

BEGIN;

ALTER TABLE IF EXISTS affiliate_order_requests
    DROP CONSTRAINT IF EXISTS affiliate_order_requests_status_check;
ALTER TABLE IF EXISTS affiliate_order_requests
    ADD CONSTRAINT affiliate_order_requests_status_check
    CHECK (status IN ('pending', 'needs_changes', 'approved', 'rejected', 'cancelled'));

ALTER TABLE IF EXISTS affiliate_order_requests
    ADD COLUMN IF NOT EXISTS requested_changes TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS commission_type_snapshot TEXT CHECK (commission_type_snapshot IN ('percentage', 'fixed')),
    ADD COLUMN IF NOT EXISTS commission_value_snapshot NUMERIC(10,2) CHECK (commission_value_snapshot >= 0);

ALTER TABLE IF EXISTS affiliates
    ADD COLUMN IF NOT EXISTS max_pending_requests INTEGER NOT NULL DEFAULT 0 CHECK (max_pending_requests >= 0),
    ADD COLUMN IF NOT EXISTS allow_urgent_orders BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE IF EXISTS products
    ADD COLUMN IF NOT EXISTS affiliate_commission_type TEXT CHECK (affiliate_commission_type IN ('percentage', 'fixed')),
    ADD COLUMN IF NOT EXISTS affiliate_commission_value NUMERIC(10,2) CHECK (affiliate_commission_value >= 0);

CREATE TABLE IF NOT EXISTS affiliate_order_request_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    affiliate_order_request_id UUID NOT NULL REFERENCES affiliate_order_requests(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL DEFAULT 'system' CHECK (actor_role IN ('system', 'affiliate', 'admin', 'operator')),
    event_type TEXT NOT NULL,
    message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_request_events_request_id
    ON affiliate_order_request_events(affiliate_order_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_request_events_org_id
    ON affiliate_order_request_events(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS affiliate_order_request_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    affiliate_order_request_id UUID NOT NULL REFERENCES affiliate_order_requests(id) ON DELETE CASCADE,
    author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_role TEXT NOT NULL CHECK (author_role IN ('affiliate', 'admin', 'operator')),
    message TEXT NOT NULL,
    internal_only BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_request_comments_request_id
    ON affiliate_order_request_comments(affiliate_order_request_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_affiliate_request_comments_org_id
    ON affiliate_order_request_comments(organization_id, created_at DESC);

COMMENT ON COLUMN affiliate_order_requests.requested_changes IS 'Cambios solicitados por admin/operator antes de aprobar';
COMMENT ON COLUMN affiliates.max_pending_requests IS 'Limite de solicitudes pendientes/correccion; 0 significa sin limite';
COMMENT ON COLUMN affiliates.allow_urgent_orders IS 'Permite o bloquea prioridad urgente para este afiliado';
COMMENT ON COLUMN products.affiliate_commission_type IS 'Comision especial para este producto en pedidos de afiliado';
COMMENT ON COLUMN products.affiliate_commission_value IS 'Valor de comision especial por producto';
COMMENT ON TABLE affiliate_order_request_events IS 'Bitacora/auditoria visible para seguimiento de solicitudes de afiliado';
COMMENT ON TABLE affiliate_order_request_comments IS 'Comentarios entre admin/operator y afiliado; internal_only oculta mensajes al afiliado';

COMMIT;
