-- Administrative audit trail for organization, user and payment changes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS organization_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_audit_logs_org_created
ON organization_audit_logs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_audit_logs_actor
ON organization_audit_logs(actor_user_id);

CREATE OR REPLACE FUNCTION audit_payment_change()
RETURNS TRIGGER AS $$
DECLARE
    payment_org UUID;
    actor_id UUID;
    source_id TEXT;
    action_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        payment_org := NEW.organization_id;
        actor_id := CASE
            WHEN COALESCE(NEW.created_by, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN NEW.created_by::uuid
            ELSE NULL
        END;
        IF TG_TABLE_NAME = 'order_payments' THEN
            source_id := NEW.order_id::text;
        ELSE
            source_id := NEW.quote_id::text;
        END IF;
        action_name := lower(TG_TABLE_NAME) || '.created';

        INSERT INTO organization_audit_logs (
            organization_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            metadata
        ) VALUES (
            payment_org,
            actor_id,
            action_name,
            TG_TABLE_NAME,
            NEW.id::text,
            jsonb_build_object(
                'amount', NEW.amount,
                'source_id', source_id,
                'payment_method', NEW.payment_method
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        payment_org := OLD.organization_id;
        actor_id := CASE
            WHEN COALESCE(OLD.created_by, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN OLD.created_by::uuid
            ELSE NULL
        END;
        IF TG_TABLE_NAME = 'order_payments' THEN
            source_id := OLD.order_id::text;
        ELSE
            source_id := OLD.quote_id::text;
        END IF;
        action_name := lower(TG_TABLE_NAME) || '.deleted';

        INSERT INTO organization_audit_logs (
            organization_id,
            actor_user_id,
            action,
            entity_type,
            entity_id,
            metadata
        ) VALUES (
            payment_org,
            actor_id,
            action_name,
            TG_TABLE_NAME,
            OLD.id::text,
            jsonb_build_object(
                'amount', OLD.amount,
                'source_id', source_id,
                'payment_method', OLD.payment_method
            )
        );
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_order_payment_insert ON order_payments;
CREATE TRIGGER audit_order_payment_insert
AFTER INSERT ON order_payments
FOR EACH ROW EXECUTE FUNCTION audit_payment_change();

DROP TRIGGER IF EXISTS audit_order_payment_delete ON order_payments;
CREATE TRIGGER audit_order_payment_delete
AFTER DELETE ON order_payments
FOR EACH ROW EXECUTE FUNCTION audit_payment_change();

DROP TRIGGER IF EXISTS audit_quote_payment_insert ON quote_payments;
CREATE TRIGGER audit_quote_payment_insert
AFTER INSERT ON quote_payments
FOR EACH ROW EXECUTE FUNCTION audit_payment_change();

DROP TRIGGER IF EXISTS audit_quote_payment_delete ON quote_payments;
CREATE TRIGGER audit_quote_payment_delete
AFTER DELETE ON quote_payments
FOR EACH ROW EXECUTE FUNCTION audit_payment_change();

COMMIT;
