-- Add missing columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS billing_name TEXT,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS billing_address TEXT,
ADD COLUMN IF NOT EXISTS customer_tier TEXT DEFAULT 'regular',
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_order_value DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS preferred_payment_method TEXT,
ADD COLUMN IF NOT EXISTS preferred_materials JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS accepts_marketing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS acquisition_source TEXT,
ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS marketing_segment TEXT,
ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Rename conflicting columns
ALTER TABLE customers 
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS company_name,
DROP COLUMN IF EXISTS notes;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(customer_tier);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(marketing_segment);
CREATE INDEX IF NOT EXISTS idx_customers_last_order_date ON customers(last_order_date DESC);

-- Update existing data
UPDATE customers SET 
    customer_tier = 'regular',
    status = 'active',
    discount_percentage = 0,
    tags = '[]'::jsonb,
    preferred_materials = '[]'::jsonb,
    accepts_marketing = false
WHERE customer_tier IS NULL;
