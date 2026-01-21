-- Tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    company VARCHAR(255),
    tax_id VARCHAR(100), -- RFC o Tax ID
    
    -- Dirección
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'México',
    
    -- Datos de facturación
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address TEXT,
    
    -- Estadísticas
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    average_order_value DECIMAL(10, 2) DEFAULT 0.00,
    last_order_date TIMESTAMP,
    
    -- Segmentación y preferencias
    customer_tier VARCHAR(50) DEFAULT 'regular', -- regular, frequent, vip, enterprise
    discount_percentage DECIMAL(5, 2) DEFAULT 0.00,
    preferred_payment_method VARCHAR(50),
    preferred_materials JSONB DEFAULT '[]'::jsonb,
    
    -- Notas internas
    internal_notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb, -- ["urgente", "buena-paga", "problematico"]
    
    -- Marketing
    accepts_marketing BOOLEAN DEFAULT true,
    marketing_segment VARCHAR(50), -- hot, warm, cold, churned
    acquisition_source VARCHAR(100), -- referral, website, social-media, etc
    
    -- Metadatos
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, blocked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Índices para búsqueda rápida
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Índices para optimizar consultas
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_tier ON customers(customer_tier);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- Historial de interacciones con clientes
CREATE TABLE IF NOT EXISTS customer_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL, -- call, email, meeting, complaint, feedback
    subject VARCHAR(255),
    description TEXT,
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    status VARCHAR(20) DEFAULT 'open', -- open, in-progress, resolved, closed
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_interactions_customer ON customer_interactions(customer_id);
CREATE INDEX idx_interactions_type ON customer_interactions(interaction_type);
CREATE INDEX idx_interactions_status ON customer_interactions(status);

-- Vincular órdenes existentes con clientes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

-- Vincular cotizaciones con clientes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);

-- Función para actualizar estadísticas del cliente automáticamente
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE customers
    SET 
        total_orders = (
            SELECT COUNT(*) 
            FROM orders 
            WHERE customer_id = NEW.customer_id 
            AND status IN ('completed', 'delivered')
        ),
        total_spent = (
            SELECT COALESCE(SUM(total_amount), 0) 
            FROM orders 
            WHERE customer_id = NEW.customer_id 
            AND status IN ('completed', 'delivered')
        ),
        average_order_value = (
            SELECT COALESCE(AVG(total_amount), 0) 
            FROM orders 
            WHERE customer_id = NEW.customer_id 
            AND status IN ('completed', 'delivered')
        ),
        last_order_date = (
            SELECT MAX(created_at) 
            FROM orders 
            WHERE customer_id = NEW.customer_id
        ),
        -- Auto-asignar tier basado en total gastado
        customer_tier = CASE
            WHEN (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = NEW.customer_id AND status IN ('completed', 'delivered')) >= 50000 THEN 'vip'
            WHEN (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = NEW.customer_id AND status IN ('completed', 'delivered')) >= 20000 THEN 'frequent'
            WHEN (SELECT COUNT(*) FROM orders WHERE customer_id = NEW.customer_id) >= 10 THEN 'frequent'
            ELSE 'regular'
        END,
        -- Auto-asignar descuento basado en tier
        discount_percentage = CASE
            WHEN (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = NEW.customer_id AND status IN ('completed', 'delivered')) >= 50000 THEN 15.00
            WHEN (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = NEW.customer_id AND status IN ('completed', 'delivered')) >= 20000 THEN 10.00
            WHEN (SELECT COUNT(*) FROM orders WHERE customer_id = NEW.customer_id) >= 10 THEN 5.00
            ELSE discount_percentage -- mantener descuento manual si existe
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.customer_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stats cuando cambia una orden
CREATE TRIGGER trigger_update_customer_stats
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW
WHEN (NEW.customer_id IS NOT NULL)
EXECUTE FUNCTION update_customer_stats();

-- Vista para análisis de clientes
CREATE OR REPLACE VIEW customer_analytics AS
SELECT 
    c.id,
    c.name,
    c.email,
    c.customer_tier,
    c.total_orders,
    c.total_spent,
    c.average_order_value,
    c.discount_percentage,
    c.last_order_date,
    c.created_at,
    c.status,
    COUNT(DISTINCT o.id) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days') as orders_last_30_days,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.created_at >= NOW() - INTERVAL '30 days'), 0) as revenue_last_30_days,
    COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= NOW() - INTERVAL '30 days') as interactions_last_30_days,
    CASE 
        WHEN c.last_order_date >= NOW() - INTERVAL '30 days' THEN 'hot'
        WHEN c.last_order_date >= NOW() - INTERVAL '90 days' THEN 'warm'
        WHEN c.last_order_date >= NOW() - INTERVAL '180 days' THEN 'cold'
        ELSE 'churned'
    END as engagement_status
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
LEFT JOIN customer_interactions ci ON c.id = ci.customer_id
GROUP BY c.id;

COMMENT ON TABLE customers IS 'CRM - Gestión completa de clientes con segmentación automática';
COMMENT ON TABLE customer_interactions IS 'Historial de interacciones y comunicaciones con clientes';
COMMENT ON VIEW customer_analytics IS 'Vista analítica con métricas y segmentación de clientes';
