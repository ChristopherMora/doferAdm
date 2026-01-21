-- Migration: Add quote templates table
-- Created: 2026-01-21

CREATE TABLE IF NOT EXISTS quote_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    material VARCHAR(50) NOT NULL,
    infill_percentage INTEGER NOT NULL DEFAULT 20 CHECK (infill_percentage >= 0 AND infill_percentage <= 100),
    layer_height DECIMAL(4,2) NOT NULL DEFAULT 0.20 CHECK (layer_height > 0),
    print_speed INTEGER NOT NULL DEFAULT 50 CHECK (print_speed > 0),
    base_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    markup_percentage INTEGER NOT NULL DEFAULT 30 CHECK (markup_percentage >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quote_templates_material ON quote_templates(material);
CREATE INDEX idx_quote_templates_created_at ON quote_templates(created_at DESC);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_quote_templates_updated_at BEFORE UPDATE ON quote_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
