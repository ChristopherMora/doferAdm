-- Migración: Agregar tablas de cotizaciones
-- Fecha: 2026-01-16

-- Tabla de cotizaciones
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    valid_until TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES users(id),
    converted_to_order_id UUID REFERENCES orders(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para cotizaciones
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_customer_email ON quotes(customer_email);
CREATE INDEX idx_quotes_created_by ON quotes(created_by);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX idx_quotes_quote_number ON quotes(quote_number);

-- Tabla de items de cotizaciones
CREATE TABLE IF NOT EXISTS quote_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    description TEXT,
    weight_grams NUMERIC(10, 2),
    print_time_hours NUMERIC(10, 2),
    material_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    labor_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    electricity_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
    other_costs NUMERIC(10, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para items de cotizaciones
CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);

-- Trigger para actualizar updated_at en quotes
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para generar número de cotización automático
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TEXT AS $$
DECLARE
    next_number INTEGER;
    quote_number TEXT;
BEGIN
    -- Obtener el siguiente número
    SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM 'Q(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM quotes
    WHERE quote_number ~ '^Q\d+$';
    
    -- Formatear como Q000001, Q000002, etc.
    quote_number := 'Q' || LPAD(next_number::TEXT, 6, '0');
    
    RETURN quote_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar número de cotización automáticamente si no se proporciona
CREATE OR REPLACE FUNCTION set_quote_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
        NEW.quote_number := generate_quote_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quote_number_trigger
BEFORE INSERT ON quotes
FOR EACH ROW
EXECUTE FUNCTION set_quote_number();
