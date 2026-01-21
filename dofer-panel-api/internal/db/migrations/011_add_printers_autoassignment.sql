-- Migration: Add printers and auto-assignment tables
-- Created: 2026-01-21

-- Printers table
CREATE TABLE IF NOT EXISTS printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('FDM', 'SLA', 'SLS')),
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('available', 'busy', 'maintenance', 'offline')),
    build_volume_width INTEGER NOT NULL, -- mm
    build_volume_height INTEGER NOT NULL, -- mm
    build_volume_depth INTEGER NOT NULL, -- mm
    materials TEXT[] NOT NULL DEFAULT '{}', -- materiales soportados
    max_layer_height DECIMAL(4,2) DEFAULT 0.4,
    min_layer_height DECIMAL(4,2) DEFAULT 0.1,
    max_print_speed INTEGER DEFAULT 100,
    current_job_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    current_job_estimated_completion TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_printers_status ON printers(status);
CREATE INDEX idx_printers_type ON printers(type);
CREATE INDEX idx_printers_current_job ON printers(current_job_order_id) WHERE current_job_order_id IS NOT NULL;

-- Printer assignment history
CREATE TABLE IF NOT EXISTS printer_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    printer_id UUID NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_start TIMESTAMP,
    estimated_completion TIMESTAMP,
    actual_start TIMESTAMP,
    actual_completion TIMESTAMP,
    assignment_method VARCHAR(20) NOT NULL CHECK (assignment_method IN ('manual', 'auto', 'optimized')),
    priority_score INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_printer_assignments_order ON printer_assignments(order_id);
CREATE INDEX idx_printer_assignments_printer ON printer_assignments(printer_id);
CREATE INDEX idx_printer_assignments_assigned_at ON printer_assignments(assigned_at DESC);

-- Add printer assignment fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS assigned_printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS estimated_start TIMESTAMP,
ADD COLUMN IF NOT EXISTS estimated_completion TIMESTAMP,
ADD COLUMN IF NOT EXISTS actual_start TIMESTAMP,
ADD COLUMN IF NOT EXISTS actual_completion TIMESTAMP,
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

CREATE INDEX idx_orders_assigned_printer ON orders(assigned_printer_id) WHERE assigned_printer_id IS NOT NULL;
CREATE INDEX idx_orders_priority ON orders(priority);

-- Triggers
CREATE TRIGGER update_printers_updated_at BEFORE UPDATE ON printers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default printers (ejemplo)
INSERT INTO printers (name, type, status, build_volume_width, build_volume_height, build_volume_depth, materials)
VALUES 
    ('Ender 3 Pro #1', 'FDM', 'available', 220, 220, 250, ARRAY['PLA', 'ABS', 'PETG']),
    ('Prusa i3 MK3S', 'FDM', 'available', 250, 210, 210, ARRAY['PLA', 'ABS', 'PETG', 'TPU', 'NYLON']),
    ('Elegoo Mars 3', 'SLA', 'available', 143, 89, 175, ARRAY['Resin'])
ON CONFLICT DO NOTHING;
