-- DOFER Panel - Initial Schema
-- Migraciones para Supabase

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios (complementa auth.users de Supabase)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    stl_file_path TEXT,
    estimated_print_time_minutes INTEGER,
    material TEXT,
    color TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de órdenes
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    public_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    order_number TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'shopify', 'local', 'other')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'printing', 'post', 'packed', 'ready', 'delivered', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low')),
    
    -- Cliente
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    
    -- Producto
    product_id UUID REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    
    -- Notas y metadatos
    notes TEXT,
    internal_notes TEXT,
    metadata JSONB,
    
    -- Asignación
    assigned_to UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Índices para órdenes
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_platform ON orders(platform);
CREATE INDEX idx_orders_public_id ON orders(public_id);
CREATE INDEX idx_orders_assigned_to ON orders(assigned_to);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Tabla de historial de estados de órdenes (auditoría)
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - Deshabilitado por ahora, activar cuando sea necesario
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Comentarios
COMMENT ON TABLE orders IS 'Tabla principal de órdenes/pedidos del sistema';
COMMENT ON COLUMN orders.public_id IS 'ID público para tracking del cliente (no exponer el UUID interno)';
COMMENT ON COLUMN orders.metadata IS 'Datos adicionales específicos de la plataforma (TikTok order_id, etc)';
COMMENT ON TABLE order_status_history IS 'Auditoría de cambios de estado de órdenes';
